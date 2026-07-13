/// <reference types="marko" />

import { parseFormData } from "@remix-run/form-data-parser";

import { httpVerbs } from "../vite/constants";
import type {
  Awaitable,
  RouteHandler,
  RouteHandlerResult,
} from "./legacy-types";
import thenable from "./thenable";
import type {
  Context,
  HandlerFunction,
  HandlerOptions,
  HttpVerb,
  HttpVerbOrAll,
  NextFunction,
  NormalizedHandler,
  NormalizedHandlerOptions,
  Platform,
  RouteMatch,
  Validator,
} from "./types";
import { href } from "./url-builder";

export { getMetaDataLookup as normalizeMeta } from "../vite/utils/meta-data";

export const NotHandled: typeof MarkoRun.NotHandled = Symbol(
  "marko-run not handled",
) as any;
export const NotMatched: typeof MarkoRun.NotMatched = Symbol(
  "marko-run not matched",
) as any;

// Private request facts forwarded to marko's `render()` second argument.
// They stay off `$global` (which _is_ the request context), and Marko derives
// patch structure rather than exposing it as application configuration.
interface MarkoRenderOptions {
  persisted?: {
    patch?: {
      fromRoute: string;
      targetRoute: string;
      // The possession echo (`x-marko-have`) the client sent: per dynamic-tag
      // hop, the renderer id the live page holds. Keyed by a build-stable
      // compiler-generated site id. Absent unless the client sent the header.
      possessed?: Record<string, string>;
    };
  };
}

interface PersistedRequest {
  fromRoute?: string;
  targetRoute?: string;
}

const persistedRequestLookup = new WeakMap<Context, PersistedRequest>();

/** @internal Marks a generated-router request as part of persisted pages. */
export function setPersisted(
  context: Context,
  fromRoute?: string,
  targetRoute?: string,
) {
  persistedRequestLookup.set(context, { fromRoute, targetRoute });
}

// Decode the client's possession echo. Untrusted request input, so a malformed
// value is dropped (the render proceeds without it -- at worst a diverging hop
// falls back to a full navigation, never a corrupt apply) rather than thrown.
function decodePossessed(request: Request) {
  const have = request.headers.get("x-marko-have");
  if (have) {
    try {
      const parsed = JSON.parse(have);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        // Untrusted input: copy onto a null-prototype object, not the parsed
        // object directly. A downstream `siteKey in possessed` check (marko's
        // fragment-vs-fills decision per hop) would otherwise spuriously hit on
        // an inherited key (`toString`, ...) or a `__proto__` data property
        // `JSON.parse` permits. `Object.assign` onto a null-prototype target
        // has no inherited `__proto__` setter, so such a key lands as an inert
        // own property instead of repointing the prototype.
        return Object.assign(
          Object.create(null) as Record<string, string>,
          parsed,
        );
      }
    } catch {
      // Malformed echo -- ignore.
    }
  }
}

const parentContextLookup = new WeakMap<Request, Context>();

const pageResponseInit = {
  status: 200,
  headers: { "content-type": "text/html;charset=UTF-8" },
};

// Persisted builds serve two representations of every page URL, negotiated on
// `accept`, so responses must vary on it. Update renders are a newline-delimited
// stream of serializer frames, not a document.
const persistedPageResponseInit = {
  status: 200,
  headers: { "content-type": "text/html;charset=UTF-8", vary: "accept" },
};

const updateResponseInit = {
  status: 200,
  headers: {
    "cache-control": "no-store",
    "content-type": "text/marko-patch;charset=UTF-8",
    vary: "accept",
  },
};

// A persisted response's `content-type` (patch, for updates) and `vary` are
// framework-owned and must hold even when a handler supplied its own `init` --
// otherwise the client router, which gates on the patch content-type, silently
// falls back to a full page load and the two representations can mis-cache.
// Unrelated `vary` tokens the caller set are preserved.
function applyPersistedResponseHeaders(response: Response, update: boolean) {
  const { headers } = response;
  if (update) {
    // Patch bytes depend on x-marko-from/x-marko-have and the live build.
    // They are navigation-specific and must never be replayed from a cache.
    headers.set("cache-control", "no-store");
    headers.set("content-type", "text/marko-patch;charset=UTF-8");
  }
  const vary = headers.get("vary");
  if (!vary) {
    headers.set("vary", "accept");
  } else if (!/(?:^|,)\s*accept\s*(?:,|$)/i.test(vary)) {
    headers.set("vary", `${vary}, accept`);
  }
  return response;
}

globalThis.MarkoRun ??= {
  NotHandled,
  NotMatched,
};

globalThis.Run ??= {
  href,
  ALL: createDefineHandler("ALL"),
  ...Object.fromEntries(
    httpVerbs.map((v) => {
      const verb = v.toUpperCase() as HttpVerb;
      return [v.toUpperCase(), createDefineHandler(verb)];
    }),
  ),
} as any;

type Rendered = ReturnType<Marko.Template["render"]> & AsyncIterable<string>;

let toReadable = (rendered: Rendered): ReadableStream<Uint8Array> => {
  toReadable = (rendered as any).toReadable
    ? (rendered) => rendered.toReadable!()
    : (rendered) => {
        let cancelled = false;
        return new ReadableStream({
          async start(ctrl) {
            const encoder = new TextEncoder();
            try {
              for await (const chunk of rendered) {
                if (cancelled) {
                  return;
                }
                ctrl.enqueue(encoder.encode(chunk));
              }
              ctrl.close();
            } catch (err) {
              if (!cancelled) {
                ctrl.error(err);
              }
            }
          },
          cancel() {
            cancelled = true;
          },
        });
      };
  return toReadable(rendered);
};

function searchParamsToObject(params: URLSearchParams | FormData) {
  const obj: Record<string, any> = {};
  for (const [key, value] of params) {
    if (key in obj) {
      const prev = obj[key];
      obj[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      obj[key] = value;
    }
  }
  return obj;
}

async function readBodyWithLimit(request: Request, maxBytes: number) {
  if (maxBytes < 0) {
    return await request.text();
  }

  const contentLength = request.headers.get("content-length");

  if (contentLength !== null && Number(contentLength) > maxBytes) {
    throw new Error("Request body too large");
  }

  if (!request.body) {
    throw new Error("Missing request body");
  }

  const reader = request.body.getReader();
  const bytes = new Uint8Array(maxBytes);
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (receivedBytes + value.byteLength > maxBytes) {
        await reader.cancel();
        throw new Error("Request body too large");
      }

      bytes.set(value, receivedBytes);
      receivedBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(
    bytes.subarray(0, receivedBytes),
  );
}

async function readBody(route: RouteMatch, context: Context) {
  const { request } = context;
  const contentType = request.headers.get("Content-Type");
  if (contentType?.includes("application/json")) {
    const { maxBytes = defaultMaxBytes, validator } = route.options.json ?? {};
    const json =
      maxBytes < 0
        ? await request.json()
        : JSON.parse(await readBodyWithLimit(request, maxBytes));
    return validator ? validator(json) : json;
  }
  const {
    maxParts = defaultMaxParts,
    maxFiles = defaultMaxFiles,
    maxFileBytes = defaultMaxBytes,
    maxBytes = maxFiles * maxFileBytes,
    onFile,
    validator,
  } = route.options.form ?? {};
  const data = searchParamsToObject(
    contentType?.includes("multipart/form-data")
      ? await parseFormData(
          request,
          {
            maxParts,
            maxFiles,
            maxFileSize: maxFileBytes,
            maxTotalSize: maxBytes,
          },
          onFile ? (file) => onFile!(context, file) : undefined,
        )
      : new URLSearchParams(await readBodyWithLimit(request, maxBytes)),
  );
  return validator ? validator(data) : data;
}

export function createContext(
  route: RouteMatch | null,
  request: Request,
  platform: Platform,
  url: URL = new URL(request.url),
): Context {
  const context: Context = {
    route: route?.path || "",
    method: request.method as HttpVerb,
    meta: route?.meta || {},
    body:
      route && request.body && (route.options.json || route.options.form)
        ? thenable(() => readBody(route, context))
        : undefined,
    data: {},
    url,
    request,
    platform,
    parent: parentContextLookup.get(request),
    serializedGlobals: {
      params: true,
      url: true,
    },
    get params() {
      const value = route
        ? route.options.params
          ? route.options.params(route.params as Record<string, any>)
          : route.params
        : {};
      Object.defineProperty(context, "params", {
        configurable: true,
        enumerable: true,
        value,
      });
      return value;
    },
    get search() {
      const search = searchParamsToObject(url.searchParams);
      const value = route?.options.search
        ? route.options.search(search)
        : search;
      Object.defineProperty(context, "search", {
        configurable: true,
        enumerable: true,
        value,
      });
      return value;
    },
    async fetch(resource, init) {
      const request = new Request(
        typeof resource === "string" ? new URL(resource, url) : resource,
        init,
      );

      parentContextLookup.set(request, context);
      return (
        (await globalThis.__marko_run__.fetch(request, platform)) ||
        new Response(null, { status: 404 })
      );
    },
    render<T>(
      template: Marko.Template<T>,
      input: T,
      init: ResponseInit = pageResponseInit,
    ) {
      const persisted = persistedRequestLookup.get(context);
      let options: MarkoRenderOptions | undefined;
      const patch =
        persisted?.fromRoute !== undefined &&
        persisted.targetRoute !== undefined
          ? {
              fromRoute: persisted.fromRoute,
              targetRoute: persisted.targetRoute,
              possessed: decodePossessed(request),
            }
          : undefined;
      // A handler's own init keeps its status/headers, but the accept-negotiated
      // content-type/vary are framework-owned and reapplied below; the default
      // init is swapped for the matching constant that carries them.
      const customInit = !!persisted && init !== pageResponseInit;
      if (persisted) {
        if (!customInit) {
          init = patch ? updateResponseInit : persistedPageResponseInit;
        }
        // Only runtime-tags (marko 6) templates understand render()'s second
        // argument -- a marko 5 (class-API) template treats a non-`out` second
        // argument as a writer and throws on its first write, so a class-API
        // route (persisted builds still allow them; they render a normal
        // document) must never receive it. Detected structurally, not by
        // version: class-API templates always carry `createOut` (runtime-class's
        // `renderable.js`), runtime-tags HTML templates never do -- `mount`
        // alone can't discriminate, since a debug-mode runtime-tags template
        // also stubs one (throwing) for a friendlier error.
        if (!("createOut" in template)) {
          options = {
            persisted: { patch },
          };
        }
      }
      const response = new Response(
        // Marko 6 takes per-render options as render()'s second argument, but
        // the ambient marko-5 `Marko.Template` types only declare the
        // stream/callback overloads, so pass options through a narrowed local
        // signature.
        toReadable(
          (
            template.render as (
              input: Marko.TemplateInput<T>,
              options?: MarkoRenderOptions,
            ) => ReturnType<Marko.Template<T>["render"]>
          )({ ...input, $global: context as unknown as Marko.Global }, options),
        ),
        init,
      );
      return customInit
        ? applyPersistedResponseHeaders(response, !!patch)
        : response;
    },
    redirect(to, status = 302) {
      if (typeof status !== "number") {
        throw new RangeError(`Invalid status code ${status}`);
      } else if (
        status < 301 ||
        status > 308 ||
        (status > 303 && status < 307)
      ) {
        throw new RangeError(`Invalid status code ${status}`);
      }
      return new Response(null, {
        status,
        headers: {
          location: (typeof to === "string" ? new URL(to, url) : to).href,
        },
      });
    },
    back(fallback = "/", status) {
      return context.redirect(
        request.headers.get("referer") || fallback,
        status,
      );
    },
  };
  return context;
}

export function render<T>(
  context: Context,
  template: Marko.Template<T>,
  input: T,
  data?: Record<string, unknown>,
) {
  if (data) {
    Object.assign(context.data, data);
  }
  return context.render(template, input);
}

const handlerMethod = new WeakMap<HandlerFunction, HttpVerb | false>();

type NextDataFunction = (data?: Record<string, unknown>) => Response;

export async function call(
  handler: HandlerFunction,
  next: NextFunction,
  context: Context,
  data?: Record<string, unknown>,
): Promise<Response> {
  let response!: RouteHandlerResult;

  if (data) {
    Object.assign(context.data, data);
  }

  let method = handlerMethod.get(handler);
  if (method === undefined) {
    handlerMethod.set(
      handler,
      (method =
        "verb" in handler && handler.verb !== "ALL"
          ? (handler.verb as HttpVerb)
          : false),
    );
  }

  if (method && method !== context.method) {
    return (next as any as NextDataFunction)(data);
  }

  if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
    let nextCallCount = 0;
    let didThrow = false;
    try {
      response = await handler(context, ((d) => {
        nextCallCount++;
        return next(d);
      }) as NextFunction);
    } catch (error) {
      didThrow = true;
      if (error instanceof Response) {
        return error;
      }
      throw error;
    } finally {
      if (!response && !didThrow && nextCallCount > 0) {
        console.warn(
          `Handler '${handler.name}' called its next function but no response was returned. ` +
            "This will cause the next function to be called again which is wasteful. " +
            "Either return or throw the result of calling `next`, return or throw a " +
            "new Response object or finally `throw null` to skip handling the request",
        );
      } else if (nextCallCount > 1) {
        console.warn(
          `Handler '${handler.name}' called its next function more than once. ` +
            "Make sure this is intentional because it is inefficient.",
        );
      }
    }
  } else {
    try {
      response = await handler(context, next);
    } catch (error) {
      if (error == null) {
        throw NotHandled;
      } else if (error instanceof Response) {
        return error;
      }
      throw error;
    }
  }

  if (response === null || response === NotMatched || response === NotHandled) {
    throw response || NotMatched;
  }
  return response || (next as any as NextDataFunction)(data);
}

export function compose(handlers: HandlerFunction[]): HandlerFunction {
  const len = handlers.length;
  if (!len) {
    return createPassthroughHandler();
  } else if (len === 1) {
    return handlers[0];
  }
  return (context, next) => {
    let i = 0;
    return (function nextHandler(data) {
      return i < len
        ? call(handlers[i++], nextHandler, context, data)
        : (next as any as NextDataFunction)(data);
    })();
  };
}

export function normalizeHandler(
  obj: RouteHandler | RouteHandler[] | Promise<RouteHandler | RouteHandler[]>,
): RouteHandler {
  if (typeof obj === "function") {
    return obj;
  } else if (Array.isArray(obj)) {
    return compose(obj as HandlerFunction[]) as RouteHandler;
  } else if (obj instanceof Promise) {
    const promise = obj.then((value) => {
      fn = (
        Array.isArray(value) ? compose(value as HandlerFunction[]) : value
      ) as RouteHandler;
    });
    let fn: RouteHandler = async (context, next) => {
      await promise;
      return fn(context, next);
    };
    return (context, next) => fn(context, next);
  }
  return passthrough;
}

export function assertHandlerVerb(
  verb: HttpVerbOrAll,
  handler: HandlerFunction,
) {
  if ("verb" in handler && handler.verb !== verb) {
    throw new Error(
      `Expected verb ${verb} but handler was defined with Run.${handler.verb}`,
    );
  }
}

function createDefineHandler<Verb extends HttpVerbOrAll>(verb: Verb) {
  return (
    optionsOrHandlers: HandlerOptions | HandlerFunction | HandlerFunction[],
    handlers: undefined | HandlerFunction | HandlerFunction[],
  ) => {
    let handler: NormalizedHandler<Context, HttpVerbOrAll, any, HandlerOptions>;

    if (typeof optionsOrHandlers === "function") {
      assertHandlerVerb(verb, optionsOrHandlers);
      handler = optionsOrHandlers as any;
      handler.options ??= {};
    } else if (Array.isArray(optionsOrHandlers)) {
      for (const h of optionsOrHandlers) assertHandlerVerb(verb, h);
      handler = compose(optionsOrHandlers) as any;
      handler.options = mergeOptions(...optionsOrHandlers);
    } else if (typeof handlers === "function") {
      assertHandlerVerb(verb, handlers);
      handler = handlers as any;
      handler.options = mergeOptions(handlers, optionsOrHandlers);
    } else if (Array.isArray(handlers)) {
      for (const h of handlers) assertHandlerVerb(verb, h);
      handler = compose(handlers) as any;
      handler.options = mergeOptions(...handlers, optionsOrHandlers);
    } else {
      handler = createPassthroughHandler() as any;
      handler.options = mergeOptions(optionsOrHandlers);
    }

    handler.verb = verb;

    return handler;
  };
}

export function normalizeValidator<T>(validator: Validator<T> | undefined) {
  return validator && typeof validator !== "function"
    ? (input: T) => {
        const result = validator["~standard"].validate(input);
        if (result instanceof Promise) {
          throw new TypeError("Schema validation must be synchronous");
        }
        return result.issues
          ? [input, result.issues]
          : [result.value, undefined];
      }
    : validator;
}

const defaultMaxBytes = 1024 * 1024;
const defaultMaxParts = 1000;
const defaultMaxFiles = 20;

export function mergeOptions(
  ...arr: (
    | NormalizedHandler<Context, "ALL", any, HandlerOptions>
    | HandlerFunction
    | HandlerOptions
  )[]
) {
  const merged: HandlerOptions = {};
  for (const item of arr) {
    let options: HandlerOptions;
    if (typeof item === "object") {
      options = item;
    } else if ("options" in item) {
      options = item.options;
    } else {
      continue;
    }
    for (const k in options) {
      const key = k as keyof typeof options;
      const option = options[key];
      if (typeof option === "object" && typeof merged[key] === "object") {
        Object.assign(merged[key], option);
      } else if (option) {
        merged[key] = option as any;
      }
    }
  }

  const result = {
    params: normalizeValidator(merged.params),
    search: normalizeValidator(merged.search),
  } as NormalizedHandlerOptions;

  if (merged.json) {
    const { maxBytes = defaultMaxBytes, validator } =
      typeof merged.json === "function" || "~standard" in merged.json
        ? { validator: merged.json }
        : merged.json;
    result.json = {
      maxBytes,
      validator: normalizeValidator(validator),
    };
  }

  if (merged.form) {
    const {
      maxBytes,
      maxFiles = defaultMaxFiles,
      maxFileBytes = defaultMaxBytes,
      maxParts = defaultMaxParts,
      onFile,
      validator,
    } = typeof merged.form === "function" || "~standard" in merged.form
      ? { validator: merged.form }
      : merged.form;
    result.form = {
      maxBytes: maxBytes ?? maxFiles * maxFileBytes,
      maxFileBytes,
      maxFiles,
      maxParts,
      onFile,
      validator: normalizeValidator(validator),
    };
  }

  return result;
}

export function stripResponseBodySync(response: Response): Response {
  return response.body ? new Response(null, response) : response;
}

export function stripResponseBody(
  response: Awaitable<Response>,
): Awaitable<Response> {
  return "then" in response
    ? response.then(stripResponseBodySync)
    : stripResponseBodySync(response);
}

export function passthrough() {}

function createPassthroughHandler(): HandlerFunction {
  return (_ctx, next) => next();
}

export function noContent() {
  return new Response(null, {
    status: 204,
  });
}

export function notHandled() {
  throw null;
}

export function notMatched() {
  return null;
}

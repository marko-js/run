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
  FormBodyValidatorOptions,
  HandlerFunction,
  HandlerOptions,
  HttpVerb,
  HttpVerbOrAll,
  JsonBodyValidatorOptions,
  NextFunction,
  NormalizedHandler,
  NormalizedHandlerOptions,
  Platform,
  RouteMatch,
  Validator,
} from "./types";
import { href } from "./url-builder";

export { getMetaDataLookup as normalizeMeta } from "../vite/utils/meta-data";

// Registered rather than unique: a build can load more than one copy of this
// module, and the sentinels must compare equal across all of them.
export const NotHandled: typeof MarkoRun.NotHandled = Symbol.for(
  "Run.Response.NotHandled",
) as any;
export const NotMatched: typeof MarkoRun.NotMatched = Symbol.for(
  "Run.Response.NotMatched",
) as any;

const parentContextLookup = new WeakMap<Request, Context>();

const pageResponseInit = {
  status: 200,
  headers: { "content-type": "text/html;charset=UTF-8" },
};

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

// Registry key for the raw render carried on a page `Response`; also read by
// `adapter/middleware`, which is bundled separately.
const kRender = Symbol.for("@marko/run.render");

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
    async render(template, input, init = pageResponseInit) {
      if (context.method === "HEAD") {
        return new Response(null, init);
      }

      const rendered = template.render({
        ...input,
        $global: context as unknown as Marko.Global,
      });

      // Older/custom renders that cannot be iterated directly go through
      // `toReadable`.
      if (!(Symbol.asyncIterator in (rendered as object))) {
        return new Response(toReadable(rendered), init);
      }

      // Created eagerly so marko attaches its error handling now: a lazy body
      // nobody reads (a HEAD request) would otherwise throw uncaught. The
      // sync render pass is pulled eagerly too and awaited below, so its
      // errors reject here and the router can render the +500 page instead.
      const iterator = peekFirstChunks(rendered[Symbol.asyncIterator]());
      const response = new Response(toResponseBody(iterator), init);
      // Lets the node adapter write the HTML strings straight to the socket.
      // `body` pins the stream, since `clone()` drains the single-use render.
      (response as any)[kRender] = {
        render: { [Symbol.asyncIterator]: () => iterator },
        body: response.body,
      };
      await iterator.first;
      return response;
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
    // HEAD is served by the auto-generated head<N> entry, which delegates to
    // get<N> and suppresses the body.  call() must not then skip GET-stamped
    // handlers when context.method is "HEAD"; an explicit HEAD export gets its
    // own entry so there is no risk of double-running it.
    if (!(method === "GET" && context.method === "HEAD")) {
      return (next as any as NextDataFunction)(data);
    }
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
      if (error == null) {
        throw NotHandled;
      } else if (error instanceof Response) {
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

    if (
      response &&
      response !== NotHandled &&
      response !== NotMatched &&
      !(response instanceof Response)
    ) {
      // Left alone this reaches the adapter, which fails reading `headers`
      // off it and names its own internals rather than the handler.
      throw new Error(
        `${handler.name ? `Handler '${handler.name}'` : "A handler"} for ${context.method} ${context.route} returned a value of type "${typeof response}" instead of a Response. ` +
          "Return `Response.json(value)` to send JSON, return a `new Response(...)`, or call `next()` to continue.",
      );
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
  verb?: string,
): RouteHandler {
  if (typeof obj === "function") {
    assertExportedVerb(obj, verb);
    return obj;
  } else if (Array.isArray(obj)) {
    for (const handler of obj) {
      if (typeof handler !== "function") {
        // Left alone, an object element crashes on the first request and a
        // primitive trips the `in` probe below with an opaque TypeError.
        throw new Error(
          `Expected every element of the ${verb ? `${verb} export of a handler` : "middleware default export"} to be a function, but one was ${typeof handler}`,
        );
      }
      assertExportedVerb(handler, verb);
    }
    return compose(obj as HandlerFunction[]) as RouteHandler;
  } else if (obj instanceof Promise) {
    const promise = obj.then((value) => {
      fn = normalizeHandler(value, verb);
    });
    // The rejection still reaches whoever calls the handler; this only keeps
    // it from surfacing as unhandled before the first call.
    promise.catch(passthrough);
    let fn: RouteHandler = async (context, next) => {
      await promise;
      return fn(context, next);
    };
    return (context, next) => fn(context, next);
  } else if (obj) {
    // Verb discovery goes by export name alone, so a truthy non-function
    // would register the route and then quietly answer 204.
    throw new Error(
      `Expected the ${verb ? `${verb} export of a handler` : "middleware default export"} to be a function or array of functions, but it was ${typeof obj}`,
    );
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

export function normalizeValidator<T>(validator: Validator<T> | undefined) {
  if (!isValidator(validator)) {
    // Anything else means no validator. Wrapping it would not throw here but
    // on the first validation, which is a far more confusing place.
    return undefined;
  }
  if (typeof validator === "function") {
    return validator;
  }
  return (input: T) => {
    const result = validator["~standard"].validate(input);
    if (result instanceof Promise) {
      throw new TypeError("Schema validation must be synchronous");
    }
    return result.issues ? [input, result.issues] : [result.value, undefined];
  };
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
    const { maxBytes = defaultMaxBytes, validator } = isValidator(merged.json)
      ? { validator: merged.json }
      : typeof merged.json === "object"
        ? merged.json
        : // Any other truthy value — `json: true` in an untyped project —
          // enables parsing with the defaults.
          ({} as JsonBodyValidatorOptions);
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
    } = isValidator(merged.form)
      ? { validator: merged.form }
      : typeof merged.form === "object"
        ? merged.form
        : ({} as FormBodyValidatorOptions<Context>);
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

const kStreaming = Symbol();

// Pulls and replays everything the synchronous render pass produced, so an
// error thrown before any real streaming — even queued behind already-emitted
// chunks — is awaitable (via `first`) ahead of sending the response.
function peekFirstChunks(
  iterator: AsyncIterator<string>,
): AsyncIterator<string> & { first: Promise<unknown> } {
  const buffered: Promise<IteratorResult<string>>[] = [];
  const first = (async () => {
    // One macrotask bounds the peek: the sync render and its error have
    // settled by then, while awaited async content has not — that streams.
    const streaming = new Promise<typeof kStreaming>((resolve) =>
      setTimeout(resolve, 0, kStreaming),
    );
    for (;;) {
      const next = Promise.resolve(iterator.next());
      // The rejection replays to whoever reads the body; this only keeps it
      // from reporting as unhandled when nothing ever reads it.
      next.catch(passthrough);
      buffered.push(next);
      const result = await Promise.race([next, streaming]);
      if (result === kStreaming || result.done) return;
    }
  })();
  first.catch(passthrough);
  return {
    first,
    next() {
      return buffered.length ? buffered.shift()! : iterator.next();
    },
    return(reason?: unknown) {
      buffered.length = 0;
      return iterator.return
        ? iterator.return(reason)
        : Promise.resolve({ done: true, value: undefined });
    },
  };
}

// A lazy body, so constructing the `Response` pulls nothing and the node adapter
// can take the render instead (see `kRender`). Must stay `iterator`'s only reader.
function toResponseBody(
  iterator: AsyncIterator<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>(
    {
      // `next()` does not always return a promise, and a rejected `pull`
      // errors the stream, which is what the failure should do anyway.
      async pull(ctrl) {
        const { done, value } = await iterator.next();
        if (done) ctrl.close();
        else ctrl.enqueue(encoder.encode(value));
      },
      async cancel(reason) {
        // An abandoned render's cleanup failure has nowhere to surface, and
        // unhandled it would take the process down on a mid-render disconnect.
        try {
          await iterator.return?.(reason);
        } catch {
          // ignored
        }
      },
    },
    { highWaterMark: 0 },
  );
}

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

// A handler whose verb disagrees with its export never runs — the runtime gates
// on the handler's own verb and answers 204. `Run.ALL` passes any method.
function assertExportedVerb(
  handler: RouteHandler | HandlerFunction,
  verb?: string,
) {
  if (
    verb &&
    "verb" in handler &&
    handler.verb !== verb &&
    handler.verb !== "ALL"
  ) {
    throw new Error(
      `The ${verb} export of a handler was defined with Run.${handler.verb} — it would never run, since the runtime only invokes it for ${handler.verb} requests`,
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
      const _fn = optionsOrHandlers;
      handler = ((ctx: Context, next: NextFunction) => _fn(ctx, next)) as any;
      handler.options = (_fn as any).options ?? {};
    } else if (Array.isArray(optionsOrHandlers)) {
      for (const h of optionsOrHandlers) assertHandlerVerb(verb, h);
      handler = compose(optionsOrHandlers) as any;
      handler.options = mergeOptions(...optionsOrHandlers);
    } else if (typeof handlers === "function") {
      assertHandlerVerb(verb, handlers);
      const _fn = handlers;
      handler = ((ctx: Context, next: NextFunction) => _fn(ctx, next)) as any;
      handler.options = mergeOptions(_fn, optionsOrHandlers);
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

// The object check comes first so the `in` probe never runs on a primitive,
// which throws.
function isValidator(option: unknown): option is Validator<any> {
  return (
    typeof option === "function" ||
    (typeof option === "object" && option !== null && "~standard" in option)
  );
}

function createPassthroughHandler(): HandlerFunction {
  return (_ctx, next) => next();
}

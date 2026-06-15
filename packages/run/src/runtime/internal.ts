/// <reference types="marko" />

import { URLSearchParams } from "node:url";

import { parseFormData } from "@remix-run/form-data-parser";

import { httpVerbs } from "../vite/constants";
import type {
  Awaitable,
  RouteHandler,
  RouteHandlerResult,
} from "./legacy-types";
import type {
  Context,
  HandlerFunction,
  HandlerOptions,
  HttpVerb,
  HttpVerbOrAll,
  NamespaceVerb,
  NextFunction,
  NormalizedHandler,
  NormalizedHandlerOptions,
  Platform,
  RouteData,
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

const parentContextLookup = new WeakMap<Request, Context>();

const serializedGlobals = { params: true, url: true };

const pageResponseInit = {
  status: 200,
  headers: { "content-type": "text/html;charset=UTF-8" },
};

globalThis.MarkoRun ??= {
  NotHandled,
  NotMatched,
};

if (!globalThis.Run) {
  const namespace: any = {
    href,
  } satisfies NamespaceVerb;
  for (const v of [...httpVerbs, "all"]) {
    const verb = v.toUpperCase() as HttpVerbOrAll;
    const def = createDefineHandler();
    (def as any as NamespaceVerb).href = href;
    namespace[verb] = def;
  }
  globalThis.Run = namespace;
}

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
    const prev = obj[key];
    obj[key] = prev
      ? Array.isArray(prev)
        ? [...prev, value] // push it on
        : [prev, value]
      : value;
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
    body:
      route && request.body
        ? async () => {
            const contentType = request.headers.get("Content-Type");
            let value: any;

            if (contentType?.includes("application/json")) {
              const { maxBytes, validator } = route.options.json;
              const json =
                maxBytes < 0
                  ? await request.json()
                  : JSON.parse(await readBodyWithLimit(request, maxBytes));
              value = validator ? validator(json) : json;
            } else {
              const {
                maxBytes,
                maxParts,
                maxFiles,
                maxFileBytes,
                onFile,
                validator,
              } = route.options.form;
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
                  : new URLSearchParams(
                      await readBodyWithLimit(request, maxBytes),
                    ),
              );
              value = validator ? validator(data) : validator;
            }

            Object.defineProperty(context, "body", {
              configurable: true,
              enumerable: true,
              value,
            });
            return value;
          }
        : undefined,
    data: {},
    url,
    request,
    platform,
    serializedGlobals,
    parent: parentContextLookup.get(request),
    async fetch(resource, init) {
      const request = new Request(
        typeof resource === "string" ? new URL(resource, this.url) : resource,
        init,
      );

      parentContextLookup.set(request, this as any);
      return (
        (await globalThis.__marko_run__.fetch(request, this.platform)) ||
        new Response(null, { status: 404 })
      );
    },
    render(template, input, init = pageResponseInit) {
      return new Response(
        toReadable(
          template.render({
            ...input,
            $global: this as unknown as Marko.Global,
          }),
        ),
        init,
      );
    },
    redirect(to, status = 302) {
      if (typeof status !== "number") {
        throw new RangeError("Invalid status code 0");
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
          location: (typeof to === "string" ? new URL(to, this.url) : to).href,
        },
      });
    },
    back(fallback = "/", status) {
      return this.redirect(
        this.request.headers.get("referer") || fallback,
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
  data?: RouteData,
) {
  if (data) {
    Object.assign(context.data, data);
  }
  return context.render(template, input);
}

export async function call(
  handler: HandlerFunction,
  next: NextFunction,
  context: Context,
  data?: RouteData,
): Promise<Response> {
  let response!: RouteHandlerResult;

  if (data) {
    Object.assign(context.data, data);
  }

  if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
    let nextCallCount = 0;
    let didThrow = false;
    try {
      response = await handler(context, (d) => {
        nextCallCount++;
        return next(d);
      });
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
  return response || next();
}

export function compose(handlers: HandlerFunction[]): HandlerFunction {
  const len = handlers.length;
  if (!len) {
    return passthroughHandler;
  } else if (len === 1) {
    return handlers[0];
  }
  return (context, next) => {
    let i = 0;
    return (
      function nextHandler(data) {
        return i < len
          ? call(handlers[i++], nextHandler, context, data)
          : next(data);
      } as NextFunction
    )();
  };
}

export function normalizeHandler(
  obj: RouteHandler | RouteHandler[] | Promise<RouteHandler | RouteHandler[]>,
): RouteHandler {
  if (typeof obj === "function") {
    return obj;
  } else if (Array.isArray(obj)) {
    return compose(obj as HandlerFunction[]);
  } else if (obj instanceof Promise) {
    const promise = obj.then((value) => {
      fn = Array.isArray(value) ? compose(value as HandlerFunction[]) : value;
    });
    let fn: RouteHandler = async (context, next) => {
      await promise;
      return fn(context, next);
    };
    return (context, next) => fn(context, next);
  }
  return passthrough;
}

function createDefineHandler() {
  return (
    optionsOrHandlers: HandlerOptions | HandlerFunction | HandlerFunction[],
    handlers: undefined | HandlerFunction | HandlerFunction[],
  ) => {
    let handler: NormalizedHandler<Context, HttpVerbOrAll, any, HandlerOptions>;

    if (typeof optionsOrHandlers === "function") {
      handler = optionsOrHandlers as any;
      handler.options = {};
    } else if (Array.isArray(optionsOrHandlers)) {
      handler = compose(optionsOrHandlers) as any;
      handler.options = {};
    } else if (typeof handlers === "function") {
      handler = handlers as any;
      handler.options = optionsOrHandlers;
    } else if (Array.isArray(handlers)) {
      handler = compose(handlers) as any;
      handler.options = optionsOrHandlers;
    } else {
      handler = passthroughHandler as any;
      handler.options = optionsOrHandlers;
    }

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
  ...fns: (
    | NormalizedHandler<Context, "ALL", any, HandlerOptions>
    | HandlerFunction
  )[]
) {
  const merged: HandlerOptions = {};
  for (const fn of fns) {
    if (typeof fn === "function" && "options" in fn) {
      const { options } = fn;
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

const passthroughHandler: HandlerFunction = (_ctx, next) => next();

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

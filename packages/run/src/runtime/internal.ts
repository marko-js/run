/// <reference types="marko" />

import type {
  AnyRoute,
  Awaitable,
  Context,
  InputObject,
  MultiRouteContext,
  NextFunction,
  Platform,
  RouteHandler,
  RouteHandlerResult,
} from "./types";

export const NotHandled: typeof MarkoRun.NotHandled = Symbol(
  "marko-run not handled",
) as any;
export const NotMatched: typeof MarkoRun.NotMatched = Symbol(
  "marko-run not matched",
) as any;

const serializedGlobals = { params: true, url: true };

const pageResponseInit = {
  status: 200,
  headers: { "content-type": "text/html;charset=UTF-8" },
};

globalThis.MarkoRun ??= {
  NotHandled,
  NotMatched,
  route(handler) {
    return handler;
  },
};

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

export function pageResponse(
  template: Marko.Template,
  input: Record<PropertyKey, unknown>,
  init: ResponseInit = pageResponseInit,
) {
  return new Response(toReadable(template.render(input) as Rendered), init);
}

export function createContext<TRoute extends AnyRoute>(
  route: TRoute | undefined,
  request: Request,
  platform: Platform,
  url: URL = new URL(request.url),
): [Context<TRoute>, (data?: InputObject) => InputObject] {
  const context: Context<TRoute> = route
    ? {
        request,
        url,
        platform,
        meta: route.meta,
        params: route.params,
        route: route.path,
        serializedGlobals,
      }
    : ({
        request,
        url,
        platform,
        meta: {},
        params: {},
        route: "",
        serializedGlobals,
      } as unknown as Context<TRoute>);

  let input: InputObject | undefined;
  return [
    context,
    (data) => {
      input ??= {
        $global: context,
      };
      return data ? Object.assign(input, data) : input;
    },
  ];
}

export async function call<TRoute extends AnyRoute>(
  handler: RouteHandler<TRoute>,
  next: NextFunction,
  context: MultiRouteContext<TRoute>,
): Promise<Response> {
  let response!: RouteHandlerResult;

  if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
    let nextCallCount = 0;
    let didThrow = false;
    try {
      response = await handler(context, () => {
        nextCallCount++;
        return next();
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

export function compose(handlers: RouteHandler[]): RouteHandler {
  const len = handlers.length;
  if (!len) {
    return (_context, next) => next();
  } else if (len === 1) {
    return handlers[0];
  }
  return (context, next) => {
    let i = 0;
    return (function nextHandler() {
      return i < len ? call(handlers[i++], nextHandler, context) : next();
    })();
  };
}

export function normalize(
  obj: RouteHandler | RouteHandler[] | Promise<RouteHandler | RouteHandler[]>,
): RouteHandler {
  if (typeof obj === "function") {
    return obj;
  } else if (Array.isArray(obj)) {
    return compose(obj);
  } else if (obj instanceof Promise) {
    const promise = obj.then((value) => {
      fn = Array.isArray(value) ? compose(value) : value;
    });
    let fn: RouteHandler = async (context, next) => {
      await promise;
      return fn(context, next);
    };
    return (context, next) => fn(context, next);
  }
  return passthrough;
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

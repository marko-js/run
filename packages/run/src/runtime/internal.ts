import type { NextFunction, RouteContext, RouteHandler } from "./types";

globalThis.Marko ??= {} as any;
globalThis.Marko.route = (handler) => handler;

export async function call(
  handler: RouteHandler,
  next: NextFunction,
  context: RouteContext
): Promise<Response> {
  let response: Response | void;
  try {
    response = await handler(context, next);
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }
    throw err;
  }
  return response || next();
}

export function compose(handlers: RouteHandler[]): RouteHandler {
  const len = handlers.length;
  if (!len) {
    return (_, next) => next();
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
  obj: RouteHandler | RouteHandler[] | Promise<RouteHandler | RouteHandler[]>
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
  throw new Error(
    `Invalid handler - expected function, array or Promise but received ${obj}`
  );
}

export function noContent() {
  return new Response(null, {
    status: 204,
  });
}

export function notHandled() {
  throw null;
}

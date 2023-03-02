import type {
  InputObject,
  NextFunction,
  Route,
  RouteContext,
  RouteHandler,
} from "./types";

export const NotHandled = Symbol();
export const NotMatched = Symbol();

globalThis.MarkoRun ??= {
  NotHandled,
  NotMatched,
  route(handler) {
    return handler;
  }
};

export function createInput(context: RouteContext) {
  let existing: InputObject | undefined;
  return (data: InputObject) => {
    existing ??= {
      $global: context
    };
    return data ? Object.assign(existing, data) : existing;
  };
}

export async function call(
  handler: RouteHandler<Route>,
  next: NextFunction,
  context: RouteContext
): Promise<Response> {
  let response: Response | null | void;

  if (process.env.NODE_ENV !== "production") {
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
            "new Response object or finally `throw null` to skip handling the request"
        );
      } else if (nextCallCount > 1) {
        console.warn(
          `Handler '${handler.name}' called its next function more than once. ` +
            "Make sure this is intentional because it is inefficient."
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

  if (response === null) {
    throw NotMatched;
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

export function notMatched() {
  return null;
}

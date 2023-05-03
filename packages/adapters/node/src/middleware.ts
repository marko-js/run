import type { IncomingMessage } from "http";
import {
  createMiddleware,
  type NodeMiddleware,
} from "@marko/run/adapter/middleware";
import type { RouteWithHandler } from "@marko/run";

declare global {
  var __marko_run_import__: Promise<void> | undefined;
}

export interface MatchedRoute {
  invoke: NodeMiddleware;
  match: RouteWithHandler;
  config: {
    _handler: NodeMiddleware;
    [key: string]: unknown;
  };
}

export { createMiddleware, NodeMiddleware };

type MatchedRequest = IncomingMessage & { route: MatchedRoute };

const passthrough: NodeMiddleware = (_req, _res, next) => {
  next?.();
};

const fetch = createMiddleware((request, platform) => {
  return globalThis.__marko_run__.fetch(request, platform);
});

const invoke = createMiddleware((request, platform) => {
  return globalThis.__marko_run__.invoke(
    (platform.request as MatchedRequest).route.match,
    request,
    platform
  );
});

const match: NodeMiddleware = (req, _res, next) => {
  const match = globalThis.__marko_run__.match(req.method!, req.url!);
  if (match) {
    (req as MatchedRequest).route = {
      invoke,
      match,
      config: {
        ...(match.meta as any),
        _handler: invoke,
      },
    };
  }
  next?.();
};

function loadRuntime(nextMiddleware: NodeMiddleware): NodeMiddleware {
  if (globalThis.__marko_run__ || globalThis.__marko_run_import__) {
    return nextMiddleware;
  }

  const promise = (globalThis.__marko_run_import__ ??= (async () => {
    if (process.env.NODE_ENV !== "production") {
      const { createViteDevServer } = await import("@marko/run/adapter");
      const devServer = await createViteDevServer();
      middleware = devServer.middlewares.use(async (req, res, next) => {
        await devServer!.ssrLoadModule("@marko/run/router");
        nextMiddleware(req, res, next);
      });
    } else {
      await import("@marko/run/router");
      middleware = nextMiddleware;
    }
  })());

  let middleware: NodeMiddleware = async (req, res, next) => {
    await promise;
    middleware(req, res, next);
  };

  return (req, res, next) => middleware(req, res, next);
}

export function matchMiddleware() {
  return loadRuntime(match);
}

export function routerMiddleware() {
  return loadRuntime(fetch);
}

export function importRouterMiddleware() {
  return loadRuntime(passthrough);
}

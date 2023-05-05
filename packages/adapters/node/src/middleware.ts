import type { IncomingMessage } from "http";
import {
  createMiddleware,
  type NodeMiddleware,
} from "@marko/run/adapter/middleware";
import type { RouteWithHandler } from "@marko/run";
import "@marko/run/router";

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

const fetch = createMiddleware(
  globalThis.__marko_run__
    ? globalThis.__marko_run__.fetch
    : (request, platform) => {
        return globalThis.__marko_run__.fetch(request, platform);
      }
);

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

const loadRuntime: (middleware: NodeMiddleware) => () => NodeMiddleware =
  process.env.NODE_ENV === "production" || globalThis.__marko_run__
    ? (middleware) => () => middleware
    : (middleware) => () => {
        if (globalThis.__marko_run_import__) {
          return middleware;
        }

        globalThis.__marko_run_import__ = (async () => {
          const { createViteDevServer } = await import("@marko/run/adapter");
          const devServer = await createViteDevServer();
          wrapped = devServer.middlewares.use(async (req, res, next) => {
            await devServer!.ssrLoadModule("@marko/run/router");
            middleware(req, res, next);
          });
        })();

        let wrapped: NodeMiddleware = async (req, res, next) => {
          await globalThis.__marko_run_import__;
          wrapped(req, res, next);
        };

        return (req, res, next) => wrapped(req, res, next);
      };

export const matchMiddleware = loadRuntime(match);
export const routerMiddleware = loadRuntime(fetch);
export const importRouterMiddleware = loadRuntime(passthrough);

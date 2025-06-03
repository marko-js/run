import type { RouteWithHandler } from "@marko/run";
import {
  createMiddleware,
  type NodeMiddleware,
  type NodeMiddlewareOptions,
  type NodePlatformInfo,
} from "@marko/run/adapter/middleware";
import type { IncomingMessage } from "http";

import ensureRuntime from "./ensure-runtime";

export { createMiddleware, type NodeMiddleware, type NodeMiddlewareOptions };

export interface MatchedRoute {
  match: RouteWithHandler;
  config: Record<string, unknown>;
}

type MatchedRequest = IncomingMessage & { route: MatchedRoute };

export const routerMiddleware = /*@__PURE__*/ ensureRuntime(
  (options?: NodeMiddlewareOptions) => {
    return createMiddleware(
      (request, platform) => globalThis.__marko_run__.fetch(request, platform),
      options,
    );
  },
);

export const invokeMiddleware = (options?: NodeMiddlewareOptions) => {
  return createMiddleware(
    (request, platform) =>
      globalThis.__marko_run__.invoke(
        ((platform as NodePlatformInfo).request as MatchedRequest).route?.match,
        request,
        platform,
      ),
    options,
  );
};

export const matchMiddleware = /*@__PURE__*/ ensureRuntime(() => {
  return (req, _res, next) => {
    const { url, method } = req as { url: string; method: string };
    const queryIndex = url.indexOf("?");
    const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const match = globalThis.__marko_run__.match(method, pathname);
    if (match) {
      (req as MatchedRequest).route = {
        match,
        config: {
          path: match.path,
          ...(match.meta as any),
        },
      };
    }
    next?.();
  };
});

export const importRouterMiddleware = /*@__PURE__*/ ensureRuntime(() => {
  return (_req, _res, next) => {
    next?.();
  };
});

import "@marko/run/router";
import ensureRuntime from "./ensure-runtime";
import {
  createMiddleware,
  type NodeMiddleware,
} from "@marko/run/adapter/middleware";
import type { IncomingMessage } from "http";
import type { RouteWithHandler } from "@marko/run";

export { createMiddleware, type NodeMiddleware };

export interface MatchedRoute {
  match: RouteWithHandler;
  config: Record<string, unknown>;
}

type MatchedRequest = IncomingMessage & { route: MatchedRoute };

export const routerMiddleware = ensureRuntime(() => {
  return createMiddleware((request, platform) =>
    globalThis.__marko_run__.fetch(request, platform)
  );
});

export const invokeMiddleware = () => {
  return createMiddleware((request, platform) =>
    globalThis.__marko_run__.invoke(
      (platform.request as MatchedRequest).route.match,
      request,
      platform
    )
  );
};

export const matchMiddleware = ensureRuntime(() => {
  return (req, _res, next) => {
    const { url, method } = req as { url: string; method: string };
    const queryIndex = url.indexOf("?");
    const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const match = globalThis.__marko_run__.match(method, pathname);
    if (match) {
      (req as MatchedRequest).route = {
        match,
        config: match.meta as any,
      };
    }
    next?.();
  };
});

export const importRouterMiddleware = ensureRuntime(() => {
  return (_req, _res, next) => {
    next?.();
  };
});

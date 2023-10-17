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
  invoke: NodeMiddleware;
  match: RouteWithHandler;
  config: {
    _handler: NodeMiddleware;
    [key: string]: unknown;
  };
}

type MatchedRequest = IncomingMessage & { route: MatchedRoute };

let _routerMiddleware: NodeMiddleware | undefined;
export const routerMiddleware = ensureRuntime(() => {
  return (_routerMiddleware ??= createMiddleware((request, platform) =>
    globalThis.__marko_run__.fetch(request, platform)
  ));
});

let _invokeMiddlware: NodeMiddleware | undefined;
export const invokeMiddleware = ensureRuntime(() => {
  return (_invokeMiddlware ??= createMiddleware((request, platform) =>
    globalThis.__marko_run__.invoke(
      (platform.request as MatchedRequest).route.match,
      request,
      platform
    )
  ));
});

let _matchMiddleware: NodeMiddleware | undefined;
export const matchMiddleware = ensureRuntime(() => {
  if (!_matchMiddleware) {
    const invoke = invokeMiddleware();
    _matchMiddleware = (req, _res, next) => {
      const { url, method } = req as { url: string; method: string };
      const queryIndex = url.indexOf("?");
      const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
      const match = globalThis.__marko_run__.match(method, pathname);
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
  }
  return _matchMiddleware;
});

export function importRouterMiddleware(): NodeMiddleware {
  return (_req, _res, next) => {
    next?.();
  };
}

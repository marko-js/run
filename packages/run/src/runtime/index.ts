import type { HandlerLike, Route } from "./types";
declare global {
  namespace Marko {
    function route<
      Data extends Record<string, unknown> = {},
      Params extends Record<string, string> = {},
      Meta = unknown
    >(handler: HandlerLike<Route<Params, Meta, string>, Data>): typeof handler;
  }
}

export type {
  HandlerLike,
  InvokeRoute,
  MatchRoute,
  NextFunction,
  RequestContext,
  Route,
  RouteContext,
  RouteContextExtensions,
  RouteData,
  RouteHandler,
  RouteWithHandler,
  Router,
} from "./types";

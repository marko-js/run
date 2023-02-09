import type { HandlerLike, ParamsObject, Route } from "./types";
declare global {
  namespace Marko {
    interface CurrentRoute extends Route {}

    type Handler<
      Params extends ParamsObject = {},
      Meta = unknown
    > = HandlerLike<Route<Params, Meta, string>>;

    function route<Params extends ParamsObject = {}, Meta = unknown>(
      handler: Handler<Params, Meta>
    ): typeof handler;
  }
}

export type {
  HandlerLike,
  InputObject,
  InvokeRoute,
  MatchRoute,
  NextFunction,
  RequestContext,
  Route,
  RouteContext,
  RouteContextExtensions,
  RouteHandler,
  RouteWithHandler,
  Router,
} from "./types";

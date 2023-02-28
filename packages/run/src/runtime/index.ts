import type { HandlerLike, ParamsObject, Route, RouteContext } from "./types";
declare global {
  namespace Marko {
    interface Global {
      context: RouteContext;
    }
  }

  namespace MarkoRun {
    interface CurrentRoute extends Route {}
    interface CurrentContext extends RouteContext<CurrentRoute> {}

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
  PathTemplate,
  RequestContext,
  Route,
  RouteContext,
  RouteContextExtensions,
  RouteHandler,
  RouteWithHandler,
  Router,
  ValidateHref,
  ValidatePath,
} from "./types";

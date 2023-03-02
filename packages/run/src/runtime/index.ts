import type { HandlerLike, ParamsObject, Route, RouteContext } from "./types";
declare global {
  namespace Marko {

    export interface Global extends MarkoRun.CurrentContext {}

    export interface Out {
      global: Global
    }
  }

  namespace MarkoRun {
    const NotHandled: symbol;
    const NotMatched: symbol;

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
  Fetch,
  HandlerLike,
  InputObject,
  Invoke,
  Match,
  NextFunction,
  PathTemplate,
  Route,
  RouteContext,
  RouteContextExtensions,
  RouteHandler,
  RouteWithHandler,
  RuntimeModule,
  ValidateHref,
  ValidatePath,
} from "./types";

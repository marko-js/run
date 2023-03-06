import type { HandlerLike, ParamsObject, Route as AnyRoute, Context as AnyContext } from "./types";
declare global {
  namespace Marko {

    export interface Global extends MarkoRun.Context {}

    export interface Out {
      global: Global
    }
  }

  namespace MarkoRun {
    const NotHandled: unique symbol;
    const NotMatched: unique symbol;

    interface Route extends AnyRoute {}
    interface Context extends AnyContext<Route> {}

    type Handler<
      Params extends ParamsObject = {},
      Meta = unknown
    > = HandlerLike<AnyRoute<Params, Meta, string>>;

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
  Context,
  ContextExtensions,
  RouteHandler,
  RouteWithHandler,
  RuntimeModule,
  ValidateHref,
  ValidatePath,
} from "./types";

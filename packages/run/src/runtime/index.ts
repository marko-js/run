import type { HandlerLike, ParamsObject, Route as AnyRoute, Context as AnyContext } from "./types";
declare global {
  namespace MarkoRun {
    const NotHandled: unique symbol;
    const NotMatched: unique symbol;

    interface Route extends AnyRoute {}
    interface Context extends AnyContext {}

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
  Context,
  ContextExtensions,
  Fetch,
  HandlerLike,
  InputObject,
  Invoke,
  Match,
  NextFunction,
  ParamsObject,
  PathTemplate,
  Route,
  RouteHandler,
  RouteWithHandler,
  RuntimeModule,
  ValidateHref,
  ValidatePath,
} from "./types";

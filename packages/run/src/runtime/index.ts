import { InlineConfig } from "vite";

import { NotHandled, NotMatched } from "./namespace";
import type {
  AnyRoute,
  GetableHref,
  GetablePath,
  GetPaths,
  HandlerLike,
  HandlerTypeFn,
  MultiRouteContext,
  Platform,
  PostableHref,
  PostablePath,
  PostPaths,
  RuntimeModule,
} from "./types";

declare global {
  var __marko_run__: RuntimeModule;
  var __marko_run_vite_config__: InlineConfig | undefined;

  namespace MarkoRun {
    export {
      GetableHref,
      GetablePath,
      GetPaths,
      NotHandled,
      NotMatched,
      Platform,
      PostableHref,
      PostablePath,
      PostPaths,
    };
    export type Route = AnyRoute;
    export type Context = MultiRouteContext<AnyRoute>;
    export type Handler = HandlerLike<AnyRoute>;
    export type GET = HandlerLike<AnyRoute, "GET">;
    export type HEAD = HandlerLike<AnyRoute, "HEAD">;
    export type POST = HandlerLike<AnyRoute, "POST">;
    export type PUT = HandlerLike<AnyRoute, "PUT">;
    export type DELETE = HandlerLike<AnyRoute, "DELETE">;
    export type PATCH = HandlerLike<AnyRoute, "PATCH">;
    export type OPTIONS = HandlerLike<AnyRoute, "OPTIONS">;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: HandlerTypeFn;
  }
}

export type {
  AppData,
  Context,
  DefineApp,
  Fetch,
  HandlerLike,
  HandlerTypeFn,
  InputObject,
  Invoke,
  LayoutInput,
  Match,
  MultiRouteContext,
  NextFunction,
  ParamsObject,
  Platform,
  Route,
  RouteHandler,
  Routes,
  RouteWithHandler,
  RuntimeModule,
  Verb,
} from "./types";

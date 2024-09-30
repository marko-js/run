import { InlineConfig } from "vite";
import { NotHandled, NotMatched } from "./namespace";
import type {
  GetPaths,
  PostPaths,
  GetablePath,
  GetableHref,
  PostablePath,
  PostableHref,
  Platform,
  HandlerTypeFn,
  RuntimeModule,
  AnyRoute,
  AnyContext,
  AnyHandler,
} from "./types";

declare global {
  var __marko_run__: RuntimeModule;
  var __marko_run_vite_config__: InlineConfig | undefined;

  namespace MarkoRun {
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: HandlerTypeFn;
    export {
      GetPaths,
      PostPaths,
      GetablePath,
      GetableHref,
      PostablePath,
      PostableHref,
      Platform,
      NotHandled,
      NotMatched,
      AnyRoute as Route,
      AnyContext as Context,
      AnyHandler as Handler,
    };
  }
}

export type {
  AppData,
  Context,
  DefineApp,
  Fetch,
  HandlerTypeFn,
  HandlerLike,
  InputObject,
  Invoke,
  Match,
  MultiRouteContext,
  NextFunction,
  ParamsObject,
  Platform,
  Route,
  Routes,
  RouteHandler,
  RouteWithHandler,
  RuntimeModule,
} from "./types";

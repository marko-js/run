import { InlineConfig } from "vite";

import { NotHandled, NotMatched } from "./namespace";
import type {
  AnyContext,
  AnyHandler,
  AnyRoute,
  GetableHref,
  GetablePath,
  GetPaths,
  HandlerTypeFn,
  Platform,
  PostableHref,
  PostablePath,
  PostPaths,
  RuntimeModule,
} from "./types";

declare global {
  const __marko_run__: RuntimeModule;
  const __marko_run_vite_config__: InlineConfig | undefined;

  namespace MarkoRun {
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: HandlerTypeFn;
    export {
      AnyContext as Context,
      GetableHref,
      GetablePath,
      GetPaths,
      AnyHandler as Handler,
      NotHandled,
      NotMatched,
      Platform,
      PostableHref,
      PostablePath,
      PostPaths,
      AnyRoute as Route,
    };
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
} from "./types";

import { NotHandled, NotMatched } from "./namespace";
import {
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
  namespace MarkoRun {
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
    }
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

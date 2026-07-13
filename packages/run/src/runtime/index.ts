import { InlineConfig } from "vite";

import type {
  AnyRoute,
  GetableHref,
  GetablePath,
  GetPaths,
  HandlerLike,
  MultiRouteContext,
  PostableHref,
  PostablePath,
  PostPaths,
} from "./legacy-types";
import { NotHandled, NotMatched } from "./namespace";
import type {
  GetContext,
  GlobalNamespace,
  Platform,
  RuntimeModule,
} from "./types";

declare global {
  var __marko_run__: RuntimeModule;
  var __marko_run_vite_config__: InlineConfig | undefined;
  var Run: GlobalNamespace;

  namespace __run__ {
    const INVARIANT: unique symbol;
    const TYPES: unique symbol;
  }

  namespace Run {
    type Context = GetContext;
  }

  interface Response {
    readonly [__run__.TYPES]: void;
  }

  /** @deprecated use \`Run\` namespace instead */
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
  }
}

export type {
  HandlerLike,
  HandlerTypeFn,
  InputObject,
  MultiRouteContext,
  ParamsObject,
  Route,
  RouteHandler,
  Routes,
} from "./legacy-types";
export type {
  App,
  Context,
  ContextForFile,
  DefineRoutes,
  Empty,
  Fetch,
  GetContext,
  Handler,
  HandlerTypes,
  Invoke,
  LayoutInput,
  Match,
  Meta,
  Middleware,
  Namespace,
  NextFunction,
  NextResponse,
  NormalizedHandler,
  NormalizedHandlerFunction,
  PartialTemplate,
  Platform,
  RouteForFileDef,
  RouteMatch,
  RuntimeModule,
  Template,
  Typed,
  HttpVerb as Verb,
} from "./types";

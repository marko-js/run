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
    /** @deprecated use the \`Run\` namespace instead */
    export type Route = AnyRoute;
    /** @deprecated use \`Run.Context\` instead */
    export type Context = MultiRouteContext<AnyRoute>;
    /** @deprecated define handlers with \`Run.GET(...)\`, \`Run.POST(...)\`, etc. instead */
    export type Handler = HandlerLike<AnyRoute>;
    /** @deprecated define handlers with \`Run.GET(...)\` instead */
    export type GET = HandlerLike<AnyRoute, "GET">;
    /** @deprecated define handlers with \`Run.HEAD(...)\` instead */
    export type HEAD = HandlerLike<AnyRoute, "HEAD">;
    /** @deprecated define handlers with \`Run.POST(...)\` instead */
    export type POST = HandlerLike<AnyRoute, "POST">;
    /** @deprecated define handlers with \`Run.PUT(...)\` instead */
    export type PUT = HandlerLike<AnyRoute, "PUT">;
    /** @deprecated define handlers with \`Run.DELETE(...)\` instead */
    export type DELETE = HandlerLike<AnyRoute, "DELETE">;
    /** @deprecated define handlers with \`Run.PATCH(...)\` instead */
    export type PATCH = HandlerLike<AnyRoute, "PATCH">;
    /** @deprecated define handlers with \`Run.OPTIONS(...)\` instead */
    export type OPTIONS = HandlerLike<AnyRoute, "OPTIONS">;
    /** @deprecated define handlers with \`Run.QUERY(...)\` instead */
    export type QUERY = HandlerLike<AnyRoute, "QUERY">;
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
  PageInput,
  PartialInput,
  PartialTemplate,
  Platform,
  RouteForFileDef,
  RouteMatch,
  RuntimeModule,
  Template,
  Typed,
  HttpVerb as Verb,
} from "./types";

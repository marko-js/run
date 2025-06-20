/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/

import { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform } from "@marko/run/namespace";
import type * as Run from "@marko/run";


declare module "@marko/run" {
	interface AppData extends Run.DefineApp<{
		routes: {
			"/a%3fb/$`$id`/$foo": { verb: "get"; };
			"/a%3fb/baz": { verb: "get"; };
		}
	}> {}
}

declare module "../src/routes/`a?b`/$`$id`/$foo/+page.marko" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/a%3fb/$`$id`/$foo"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/`a?b`/baz/+page.marko" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/a%3fb/baz"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }
}

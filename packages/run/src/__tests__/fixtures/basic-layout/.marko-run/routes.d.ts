/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/

import { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform } from "@marko/run/namespace";
import type * as Run from "@marko/run";


declare module "@marko/run" {
	interface AppData extends Run.DefineApp<{
		routes: {
			"/": Routes["/"];
		}
	}> {}
}

declare module "../src/routes/+page.marko" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/+layout.marko" {
  export interface Input {
    [Run.ContentKeyFor<typeof import('../src/routes/+layout.marko')>]: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }
}

type Routes = {
	"/": { verb: "get"; };
}

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
			"/foo": Routes["/foo"];
			"/foo/bar": Routes["/foo/bar"];
			"/foo/bar/baz": Routes["/foo/bar/baz"];
			"/foo/baz": Routes["/foo/baz"];
			"/bar": Routes["/bar"];
			"/bar/baz": Routes["/bar/baz"];
			"/baz": Routes["/baz"];
		}
	}> {}
}

declare module "./foo,/bar,/,baz/+page.marko" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/" | "/foo" | "/foo/bar" | "/foo/bar/baz" | "/foo/baz" | "/bar" | "/bar/baz" | "/baz"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }
}

type Routes = {
	"/": { verb: "get"; };
	"/foo": { verb: "get"; };
	"/foo/bar": { verb: "get"; };
	"/foo/bar/baz": { verb: "get"; };
	"/foo/baz": { verb: "get"; };
	"/bar": { verb: "get"; };
	"/bar/baz": { verb: "get"; };
	"/baz": { verb: "get"; };
}

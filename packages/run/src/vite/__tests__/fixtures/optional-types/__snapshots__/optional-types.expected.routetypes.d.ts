/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/

import { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform } from "@marko/run/namespace";
import type * as Run from "@marko/run";


declare module "@marko/run" {
	interface AppData extends Run.DefineApp<{
		routes: {
			"/aaa/:aId": Routes["/aaa/$aId"];
			"/aaa/:aId/bbb/:bId": Routes["/aaa/$aId/bbb/$bId"];
			"/aaa/:aId/bbb/:bId/ccc/:cId": Routes["/aaa/$aId/bbb/$bId/ccc/$cId"];
			"/aaa/:aId/ccc/:cId": Routes["/aaa/$aId/ccc/$cId"];
		}
	}> {}
}

declare module "./aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.get" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/aaa/:aId" | "/aaa/:aId/bbb/:bId" | "/aaa/:aId/bbb/:bId/ccc/:cId" | "/aaa/:aId/ccc/:cId"];
    export type Context = Run.MultiRouteContext<Route>;
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "./+middleware" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/aaa/:aId" | "/aaa/:aId/bbb/:bId" | "/aaa/:aId/bbb/:bId/ccc/:cId" | "/aaa/:aId/ccc/:cId"];
    export type Context = Run.MultiRouteContext<Route>;
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "./aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/aaa/:aId" | "/aaa/:aId/bbb/:bId" | "/aaa/:aId/bbb/:bId/ccc/:cId" | "/aaa/:aId/ccc/:cId"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "./+layout.marko" {
  export interface Input extends Run.LayoutInput<typeof import('./+layout.marko')> {}
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/aaa/:aId" | "/aaa/:aId/bbb/:bId" | "/aaa/:aId/bbb/:bId/ccc/:cId" | "/aaa/:aId/ccc/:cId"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use `((context, next) => { ... }) satisfies MarkoRun.Handler` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }
}

type Routes = {
	"/aaa/$aId": { verb: "get"; };
	"/aaa/$aId/bbb/$bId": { verb: "get"; };
	"/aaa/$aId/bbb/$bId/ccc/$cId": { verb: "get"; };
	"/aaa/$aId/ccc/$cId": { verb: "get"; };
}

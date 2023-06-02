/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/

import { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform } from "@marko/run/namespace";
import type Run from "@marko/run";


declare module "@marko/run" {
	interface AppData extends Run.DefineApp<{
		routes: {
			"/a%2Fb%2Fc/:$id": Routes["/a%2Fb%2Fc/$%24id"]
		}
	}> {}
}

declare module "./a%2Fb%2Fc/$%24id/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/a%2Fb%2Fc/:$id"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

type Routes = {
	"/a%2Fb%2Fc/$%24id": { verb: "get"; };
}

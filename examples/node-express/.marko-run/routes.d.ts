/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/

import { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform } from "@marko/run/namespace";
import type Run from "@marko/run";
import type { NodePlatformInfo } from '@marko/run-adapter-node'

declare module "@marko/run" {
	interface Platform extends NodePlatformInfo {}

	interface AppData extends Run.DefineApp<{
		routes: {
			"/": {
				verb: "get" | "post";
				meta: typeof import("../src/routes/+meta.json");
			};
			"/users": { verb: "get" };
			"/users/:id": { verb: "get" };
			"/users/foo": { verb: "get" };
			"/other/:rest*": { verb: "get" };
		}
	}> {}
}

declare module "../src/routes/+handler.js" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/"];
    export type Context = Run.MultiRouteContext<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/other/$$rest/+handler" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/other/:rest*"];
    export type Context = Run.MultiRouteContext<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/+middleware.js" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/" | "/users" | "/users/:id" | "/users/foo" | "/other/:rest*"];
    export type Context = Run.MultiRouteContext<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/_one/users/$id/+middleware.js" {
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/users/:id"];
    export type Context = Run.MultiRouteContext<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/_one/users/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/users"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/_one/users/$id/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/users/:id"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/_two/users/foo/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/users/foo"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/other/$$rest/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/other/:rest*"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/+layout.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/" | "/users" | "/users/:id" | "/users/foo" | "/other/:rest*"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/_one/users/+layout.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/users" | "/users/:id"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/_one/users/$id/+layout.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Routes["/users/:id"];
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/+404.marko" {
  export interface Input {}
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = Run.Route;
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

declare module "../src/routes/+500.marko" {
  export interface Input {
    error: unknown;
  }
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = globalThis.MarkoRun.Route;
    export type Context = Run.MultiRouteContext<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Route>;
  }
}

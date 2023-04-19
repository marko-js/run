/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/

import "@marko/run/namespace";
import type Run from "@marko/run";


type Route1 = Run.Route<[], undefined, `/`>;
type Route2 = Run.Route<[], typeof import("./_protected/_home/new/+meta.json"), `/new`>;
type Route3 = Run.Route<["id"], undefined, `/notes/:id`>;
type Route4 = Run.Route<["id"], typeof import("./_protected/_home/notes/$id/comments/+meta")["default"], `/notes/:id/comments`>;
type Route5 = Run.Route<[], undefined, `/callback/oauth2`>;
type Route6 = Run.Route<[], undefined, `/my`>;
type Route7 = Run.Route<["match"], undefined, `/:match*`>;

declare module "@marko/run" {
	interface AppData {
		routes: Route1 | Route2 | Route3 | Route4 | Route5 | Route6 | Route7;
		get: "/" | "/new" | "/notes/${id}" | "/callback/oauth2" | "/my" | "/${...match}";
		post: "/new" | "/notes/${id}" | "/notes/${id}/comments";
	}
}

declare module "./_protected/_home/new/+handler.post" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route2;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./_protected/_home/notes/$id/+handler.put_post_delete" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route3;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./_protected/_home/notes/$id/comments/+handler.put_post_delete" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route4;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./callback/oauth2/+handler.get" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route5;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./my/+handler.get" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route6;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./$$match/+handler.get" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route7;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./+middleware" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route1 | Route2 | Route3 | Route4 | Route5 | Route6 | Route7;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./_protected/+middleware" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route1 | Route2 | Route3 | Route4;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./_protected/_home/+middleware" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route1 | Route2 | Route3 | Route4;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./_protected/_home/notes/$id/+middleware" {
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route3 | Route4;
    export type Context = Run.Context<Route>;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./_protected/_home/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route1;
    export type Context = Run.Context<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./_protected/_home/new/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route2;
    export type Context = Run.Context<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./_protected/_home/notes/$id/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route3;
    export type Context = Run.Context<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./my/+page.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route6;
    export type Context = Run.Context<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./+layout.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route1 | Route2 | Route3 | Route6;
    export type Context = Run.Context<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./_protected/_home/+layout.marko" {
  export interface Input {
    renderBody: Marko.Body;
  }
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Route1 | Route2 | Route3;
    export type Context = Run.Context<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./+404.marko" {
  export interface Input {}
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = Run.Route;
    export type Context = Run.Context<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

declare module "./+500.marko" {
  export interface Input {
    error: unknown;
  }
  namespace MarkoRun {
    export * from "@marko/run/namespace";
    export type Route = globalThis.MarkoRun.Route;
    export type Context = Run.Context<Route> & Marko.Global;
    export type Handler = Run.HandlerLike<Route>;
    export const route: Run.HandlerTypeFn<Handler>;
  }
}

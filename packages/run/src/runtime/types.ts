/// <reference types="marko" />

import type { HttpVerb } from "../vite";

type OneOrMany<T> = T | T[];
type NoParams = {};
type AllKeys<T> = T extends T ? keyof T : never;
type Simplify<T> = T extends unknown ? { [K in keyof T]: T[K] } : never;
type IsObject<T> = T extends object
  ? T extends any[]
    ? 0
    : T extends (...args: any[]) => any
      ? 0
      : 1
  : 0;
type SuperSet<T, U extends T> = T & {
  [K in AllKeys<U> as K extends keyof T ? never : K]?: never;
};
type SuperSets<T, U extends T, K extends keyof T> = Omit<T, K> & {
  [P in K]: Simplify<SuperSet<T[P], U[P]>>;
};

export type Awaitable<T> = Promise<T> | T;

export type Verb = Uppercase<HttpVerb>;

export interface Platform {}

export interface Context<
  TRoute extends Route = AnyRoute,
  TVerb extends Verb = Verb,
> {
  readonly url: URL;
  readonly request: Request;
  readonly method: TVerb;
  readonly route: TRoute["path"];
  readonly params: TRoute["params"];
  readonly meta: NormalizedMeta<TRoute["meta"], TVerb>;
  readonly platform: Platform;
  readonly serializedGlobals: Record<string, boolean>;
  readonly parent: Context | undefined;
  render<T>(
    template: Marko.Template<T>,
    input: T,
    init?: ResponseInit,
  ): Response;
  fetch(
    resource: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response>;
  redirect(to: string | URL, status?: number): Response;
  back(fallback?: string | URL, status?: number): Response;
}

export type MultiRouteContext<
  TRoute extends Route,
  TVerb extends Verb = Verb,
  _Preserved extends TRoute = TRoute,
> = TRoute extends any
  ? TVerb extends any
    ? Context<Simplify<SuperSets<TRoute, _Preserved, "params">>, TVerb>
    : never
  : never;

export type ParamsObject = Record<string, string>;
export type InputObject = Record<PropertyKey, any>;
export type NextFunction = () => Awaitable<Response>;

export type HandlerLike<
  TRoute extends Route = AnyRoute,
  TVerb extends Verb = Verb,
> = Awaitable<OneOrMany<RouteHandler<TRoute, TVerb>>>;

export type RouteHandlerResult =
  | Response
  | typeof MarkoRun.NotHandled
  | typeof MarkoRun.NotMatched
  | null
  | void;

export type RouteHandler<
  TRoute extends Route = AnyRoute,
  TVerb extends Verb = Verb,
> = (
  context: MultiRouteContext<TRoute, TVerb>,
  next: NextFunction,
) => Awaitable<RouteHandlerResult>;

export interface Route<
  Params extends ParamsObject = ParamsObject,
  Meta = any,
  Path extends string = string,
> {
  path: Path;
  params: Params;
  meta: Meta;
}

type DefineRoutes<T extends Record<string, { meta?: unknown }>> = {
  [K in keyof T]: K extends string
    ? T[K] extends { meta: infer Meta }
      ? Route<PathParams<K>, Meta, K>
      : Route<PathParams<K>, any, K>
    : never;
};

type DefinePaths<
  T extends Record<string, { verb: unknown }>,
  TVerb extends "get" | "post",
> = {
  [K in keyof T]: K extends string
    ? T[K] extends { verb: infer V }
      ? V extends TVerb
        ? K
        : never
      : never
    : never;
}[keyof T];

export type DefineApp<
  T extends {
    routes: Record<string, { verb: "get" | "post"; meta?: unknown }>;
  },
> = {
  routes: DefineRoutes<T["routes"]>;
  getPaths: DefinePaths<T["routes"], "get">;
  postPaths: DefinePaths<T["routes"], "post">;
};

export interface RouteWithHandler<
  Params extends ParamsObject = ParamsObject,
  Meta = unknown,
  Path extends string = string,
> extends Route<Params, Meta, Path> {
  handler: RouteHandler<this>;
}

export type Fetch<TPlatform extends Platform = Platform> = (
  request: Request,
  platform: TPlatform,
) => Promise<Response | void>;

export type Match = (
  method: string,
  pathname: string,
) => RouteWithHandler | null;

export type Invoke<TPlatform extends Platform = Platform> = (
  route: RouteWithHandler | null,
  request: Request,
  platform: TPlatform,
) => Promise<Response | void>;

export interface RuntimeModule {
  fetch<TPlatform extends Platform = Platform>(
    ...args: Parameters<Fetch<TPlatform>>
  ): ReturnType<Fetch<TPlatform>>;
  match: Match;
  invoke<TPlatform extends Platform = Platform>(
    ...args: Parameters<Invoke<TPlatform>>
  ): ReturnType<Invoke<TPlatform>>;
}

type Member<T, U> = T extends T ? (U extends T ? T : never) : never;

type PathParamKeys<Path extends string> =
  Path extends `${infer _}$${infer Param}/${infer Rest}`
    ? [Unescape<Param>, ...PathParamKeys<Rest>]
    : Path extends `${infer _}$$${infer Param}`
      ? [Unescape<Param>]
      : Path extends `${infer _}$${infer Param}`
        ? [Unescape<Param>]
        : [];

type Unescape<Escaped extends string> = Escaped extends `\`${infer Value}\``
  ? Value
  : Escaped;

type PathParams<
  Path extends string,
  Keys extends string[] = PathParamKeys<Path>,
> = 0 extends Keys["length"] ? NoParams : { [K in Keys[number]]: string };

type Segments<T extends string, Acc extends string[] = []> = T extends ""
  ? Acc
  : T extends `${infer Left}/${infer Rest}`
    ? Segments<Rest, [...Acc, Left]>
    : [...Acc, T];

type GTE<A extends any[], B extends any[]> = A["length"] extends B["length"]
  ? 1
  : A extends [infer _Ha, ...infer Ta]
    ? B extends [infer _Hb, ...infer Tb]
      ? GTE<Ta, Tb>
      : 1
    : 0;

type MatchSegments<
  A extends string,
  B extends string,
> = A extends `${infer P}/${string}*`
  ? 1 extends GTE<Segments<B>, Segments<P>>
    ? `${P}/${string}`
    : never
  : Segments<B>["length"] extends Segments<A>["length"]
    ? A
    : never;

type PathPattern<T extends string> =
  T extends `${infer Left}/\${${string}}/${infer Rest}`
    ? PathPattern<`${Left}/${string}/${Rest}`>
    : T extends `${infer Left}/\${...${string}}`
      ? PathPattern<`${Left}/${string}*`>
      : T extends `${infer Left}/\${${string}}`
        ? PathPattern<`${Left}/${string}`>
        : T;

type ValidatePath<Paths extends string, Path extends string> =
  | Paths
  | (Path extends `/${string}`
      ? MatchSegments<Member<PathPattern<Paths>, Path>, Path>
      : Path);

type ValidateHref<
  Paths extends string,
  Href extends string,
> = Href extends `${infer P}#${infer H}?${infer Q}`
  ? `${ValidatePath<Paths, P>}#${H}?${Q}`
  : Href extends `${infer P}?${infer Q}`
    ? `${ValidatePath<Paths, P>}?${Q}`
    : Href extends `${infer P}#${infer H}`
      ? `${ValidatePath<Paths, P>}#${H}`
      : ValidatePath<Paths, Href>;

type NormalizedMetaObject<T, TVerb extends Verb = Verb> =
  IsObject<T> extends 1
    ? TVerb extends keyof T
      ? Simplify<Omit<T, Verb | keyof T[TVerb]> & T[TVerb]>
      : Simplify<Omit<T, Verb>>
    : never;

export type NormalizedMeta<T, TVerb extends Verb = Verb> =
  IsObject<T> extends 1
    ? { [K in TVerb]: NormalizedMetaObject<T, K> }[TVerb]
    : T;

export type NormalizedMetaLookup<T> = {
  [K in Verb]: IsObject<T> extends 1 ? NormalizedMetaObject<T, K> : T;
};

export interface AppData {}

export type Routes = AppData extends { routes: infer T }
  ? T
  : Record<string, Route>;

export type AnyRoute = Routes[keyof Routes];

export type HandlerTypeFn<TRoute extends Route = AnyRoute> = AppData extends {
  routes: any;
}
  ? <
      Params extends ParamsObject = ParamsObject,
      Meta = any,
      T extends HandlerLike<Route<Params, Meta>> = HandlerLike<
        Route<Params, Meta>
      >,
    >(
      handler: T,
    ) => T
  : <T extends HandlerLike<TRoute>>(handler: T) => T;

type DefaultAPI = keyof Exclude<
  Marko.Renderable,
  Marko.Template<any, any> | Marko.Body<any, any> | string
> extends "content"
  ? "tags"
  : "class";
type TemplateAPI<T> = T extends { api: infer API } ? API : DefaultAPI;
export type LayoutInput<T> =
  TemplateAPI<T> extends "tags"
    ? { content: Marko.Body }
    : { renderBody: Marko.Body };

export type GetPaths = AppData extends { getPaths: infer T } ? T : string;
export type PostPaths = AppData extends { postPaths: infer T } ? T : string;
export type GetablePath<T extends string> = ValidatePath<GetPaths, T>;
export type GetableHref<T extends string> = ValidateHref<GetPaths, T>;
export type PostablePath<T extends string> = ValidatePath<PostPaths, T>;
export type PostableHref<T extends string> = ValidateHref<PostPaths, T>;

type Awaitable<T> = Promise<T> | T;
type OneOrMany<T> = T | T[];
type NoParams = {};

export interface Platform {}

export interface Context<TRoute extends AnyRoute = AnyRoute> {
  readonly url: URL;
  readonly request: Request;
  readonly route: TRoute["path"];
  readonly params: TRoute["params"];
  readonly meta: TRoute["meta"];
  readonly platform: Platform;
  readonly serializedGlobals: Record<string, boolean>;
}

export type MultiRouteContext<TRoute extends AnyRoute> = TRoute extends any
  ? Context<TRoute>
  : never;

export type ParamsObject = Record<string, string>;
export type InputObject = Record<PropertyKey, any>;
export type NextFunction = () => Awaitable<Response>;

export type HandlerLike<TRoute extends AnyRoute = AnyRoute> = Awaitable<
  OneOrMany<RouteHandler<TRoute>>
>;

export type RouteHandler<TRoute extends AnyRoute = AnyRoute> = (
  context: MultiRouteContext<TRoute>,
  next: NextFunction
) => Awaitable<Response | null | void>;

export interface Route<Params extends ParamsObject, Meta, Path extends string> {
  path: Path;
  params: Params;
  meta: Meta;
}

type DefineRoutes<T extends Record<string, { meta?: unknown }>> = {
  [K in keyof T]: K extends string
    ? T[K] extends { meta: infer Meta }
      ? Route<PathParams<K>, Meta, K>
      : Route<PathParams<K>, unknown, K>
    : never;
};

type DefinePaths<
  T extends Record<string, { verb: unknown }>,
  Verb extends "get" | "post"
> = {
  [K in keyof T]: K extends string
    ? T[K] extends { verb: infer V }
      ? V extends Verb
        ? ConvertPath<K>
        : never
      : never
    : never;
}[keyof T];

export type DefineApp<
  T extends {
    routes: Record<string, { verb: "get" | "post"; meta?: unknown }>;
  }
> = {
  routes: DefineRoutes<T["routes"]>;
  getPaths: DefinePaths<T["routes"], "get">;
  postPaths: DefinePaths<T["routes"], "post">;
};

export interface RouteWithHandler<
  Params extends ParamsObject = ParamsObject,
  Meta = unknown,
  Path extends string = string
> extends Route<Params, Meta, Path> {
  handler: RouteHandler<this>;
}

export type Fetch<TPlatform extends Platform = Platform> = (
  request: Request,
  platform: TPlatform
) => Promise<Response | void>;

export type Match = (
  method: string,
  pathname: string
) => RouteWithHandler | null;

export type Invoke<TPlatform extends Platform = Platform> = (
  route: RouteWithHandler | null,
  request: Request,
  platform: TPlatform
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
  Path extends `${infer _}:${infer Param}/${infer Rest}`
    ? [Param, ...PathParamKeys<Rest>]
    : Path extends `${infer _}:${infer Param}*`
    ? [Param]
    : Path extends `${infer _}:${infer Param}`
    ? [Param]
    : [];

type PathParams<
  Path extends string,
  Keys extends string[] = PathParamKeys<Path>
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
  B extends string
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

export type ConvertPath<Path extends string> =
  Path extends `${infer Left}/:${infer Param}/${infer Rest}`
    ? ConvertPath<`${Left}/\${${Param}}/${Rest}`>
    : Path extends `${infer Left}/:${infer Param}*`
    ? `${Left}/\${${Param}...}`
    : Path extends `${infer Left}/:${infer Param}`
    ? `${Left}/\${${Param}}`
    : Path;

type ValidatePath<Paths extends string, Path extends string> =
  | Paths
  | (Path extends `/${string}`
      ? MatchSegments<Member<PathPattern<Paths>, Path>, Path>
      : Path);

type ValidateHref<
  Paths extends string,
  Href extends string
> = Href extends `${infer P}#${infer H}?${infer Q}`
  ? `${ValidatePath<Paths, P>}#${H}?${Q}`
  : Href extends `${infer P}?${infer Q}`
  ? `${ValidatePath<Paths, P>}?${Q}`
  : Href extends `${infer P}#${infer H}`
  ? `${ValidatePath<Paths, P>}#${H}`
  : ValidatePath<Paths, Href>;

export interface AppData {}

type HasAppData = AppData extends { routes: any } ? 1 : 0;
type AnyParams = 0 extends HasAppData ? ParamsObject : never;
type AnyMeta = 0 extends HasAppData ? unknown : never;

export type Routes = AppData extends { routes: infer T }
  ? T
  : Record<string, Route<ParamsObject, unknown, string>>;

export type AnyRoute = Routes[keyof Routes];

export type AnyContext = MultiRouteContext<AnyRoute>;

export type AnyHandler<
  Params extends AnyParams = AnyParams,
  Meta extends AnyMeta = AnyMeta
> = 0 extends HasAppData
  ? HandlerLike<Route<Params, Meta, string>>
  : HandlerLike<AnyRoute>;

export type HandlerTypeFn<THandler extends HandlerLike = AnyHandler> =
  0 extends HasAppData
    ? <Params extends ParamsObject = ParamsObject, Meta = unknown>(
        handler: HandlerLike<Route<Params, Meta, string>>
      ) => HandlerLike<Route<Params, Meta, string>>
    : (handler: THandler) => THandler;

export type GetPaths = AppData extends { getPaths: infer T } ? T : string;
export type PostPaths = AppData extends { postPaths: infer T } ? T : string;
export type GetablePath<T extends string> = ValidatePath<GetPaths, T>;
export type GetableHref<T extends string> = ValidateHref<GetPaths, T>;
export type PostablePath<T extends string> = ValidatePath<PostPaths, T>;
export type PostableHref<T extends string> = ValidateHref<PostPaths, T>;

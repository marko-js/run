type Awaitable<T> = Promise<T> | T;
type OneOrMany<T> = T | T[];

export interface Platform {}
export interface ContextExtensions {}

// Here the `TRoute extends any` condition ensures `TRoute` will be
// distributed when it is a union type of mulitple routes. This enables
// the resulting type to be correctly narrowed on the `route` property.
export type Context<TRoute extends Route = Route> = TRoute extends any
  ? ContextExtensions & {
      readonly url: URL;
      readonly request: Request;
      readonly route: TRoute["path"];
      readonly params: TRoute["params"];
      readonly meta: TRoute["meta"];
      readonly platform: Platform;
      readonly serializedGlobals: Record<string, boolean>;
    }
  : never;

export interface NoParams {}
export type ParamsObject = Record<string, string> & NoParams;
export type InputObject = Record<PropertyKey, any>;
export type NextFunction = () => Awaitable<Response>;

export type HandlerLike<TRoute extends Route = Route> = Awaitable<
  OneOrMany<RouteHandler<TRoute>>
>;

export type RouteHandler<TRoute extends Route = Route> = (
  context: Context<TRoute>,
  next: NextFunction
) => Awaitable<Response | null | void>;

export interface Route<
  Params extends ParamsObject | string[] = ParamsObject,
  Meta = unknown,
  Path extends string = string
> {
  path: Path;
  params: Params extends string[]
    ? 0 extends Params["length"]
      ? NoParams
      : { [K in Params[number]]: string }
    : Params;
  meta: Meta;
}

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

export type PathTemplate<Path extends string> =
  Path extends `${infer Left}/\${${string}}/${infer Rest}`
    ? PathTemplate<`${Left}/${string}/${Rest}`>
    : Path extends `${infer Left}/\${${string}}`
    ? PathTemplate<`${Left}/${string}`>
    : Path;

export type ValidatePath<Paths extends string, Path extends string> =
  | Paths
  | (Path extends `/${string}`
      ? MatchSegments<Member<PathPattern<Paths>, Path>, Path>
      : Path);

export type ValidateHref<
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

export type AnyRoute = AppData extends { routes: infer T } ? T : Route;
export type AnyContext = Context<AnyRoute>;
export type AnyHandler<
  Params extends AnyParams = AnyParams,
  Meta extends AnyMeta = AnyMeta
> = 0 extends HasAppData
  ? HandlerLike<Route<Params, Meta>>
  : HandlerLike<AnyRoute>;

export type HandlerTypeFn<THandler extends HandlerLike = AnyHandler> = 0 extends HasAppData
  ? <Params extends ParamsObject = ParamsObject, Meta = unknown>(
      handler: HandlerLike<Route<Params, Meta>>
    ) => HandlerLike<Route<Params, Meta>>
  : (handler: THandler) => THandler;

export type GetPaths = AppData extends { get: infer T } ? T : string;
export type PostPaths = AppData extends { post: infer T } ? T : string;
export type GetablePath<T extends string> = ValidatePath<GetPaths, T>;
export type GetableHref<T extends string> = ValidateHref<GetPaths, T>;
export type PostablePath<T extends string> = ValidatePath<PostPaths, T>;
export type PostableHref<T extends string> = ValidateHref<PostPaths, T>;

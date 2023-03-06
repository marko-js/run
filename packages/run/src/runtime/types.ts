type Awaitable<T> = Promise<T> | T;
type OneOrMany<T> = T | T[];
type Combine<T> = T extends object ? { [P in keyof T]: T[P] } : T;

export interface ContextExtensions {}

export type ParamsObject = Record<string, string>;
export type InputObject = Record<PropertyKey, any>;

export type Context<
  Platform = unknown,
  TRoute extends Route = Route,
> = TRoute extends any
  ? Combine<
      ContextExtensions &
        Readonly<{
          url: URL;
          request: Request;
          route: TRoute["path"];
          params: TRoute["params"];
          meta: TRoute["meta"];
          platform: Platform;
        }>
    >
  : never;

export type NextFunction = () => Awaitable<Response>;

export type HandlerLike<TRoute extends Route = Route> = Awaitable<
  OneOrMany<RouteHandler<TRoute>>
>;

export type RouteHandler<TRoute extends Route = Route> = (
  context: Context<unknown, TRoute>,
  next: NextFunction
) => Awaitable<Response | null | void>;

export interface Route<
  Params extends ParamsObject = {},
  Meta = unknown,
  Path extends string = string
> {
  path: Path;
  params: Params;
  meta: Meta;
}

export interface RouteWithHandler<
  Params extends ParamsObject = {},
  Meta = unknown,
  Path extends string = string
> extends Route<Params, Meta, Path> {
  handler: RouteHandler<this>;
}

export type Fetch<Platform = unknown> = (
  request: Request,
  platform: Platform
) => Promise<Response | void>;

export type Match = (
  method: string,
  pathname: string
) => RouteWithHandler | null;

export type Invoke = <Platform = unknown>(
  route: RouteWithHandler | null,
  request: Request,
  platform: Platform
) => Promise<Response | void>

export interface RuntimeModule {
  fetch: <Platform = unknown>(
    request: Request,
    platform: Platform
  ) => Promise<Response | void>;
  match: (
    method: string,
    pathname: string
  ) => RouteWithHandler | null;
  invoke: <Platform = unknown>(
    route: RouteWithHandler | null,
    request: Request,
    platform: Platform
  ) => Promise<Response | void>
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

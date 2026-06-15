import type {
  AppPaths,
  Context,
  HttpVerb,
  NextFunction,
  NormalizedMeta,
  PathsForVerb,
  Route as NewRoute,
  RouteDef,
} from "./types";

type OneOrMany<T> = T | T[];
type NoParams = {};
type AllKeys<T> = T extends T ? keyof T : never;
type Simplify<T> = T extends unknown ? { [K in keyof T]: T[K] } : never;
type SuperSet<T, U extends T> = T & {
  [K in AllKeys<U> as K extends keyof T ? never : K]?: never;
};
type SuperSets<T, U extends T, K extends keyof T> = Omit<T, K> & {
  [P in K]: Simplify<SuperSet<T[P], U[P]>>;
};

type Union<T> = T[keyof T];

type MigrateContext<T extends Route> = Context<
  NewRoute<RouteDef<T["path"], T["method"], T["meta"]>>
>;

export type Awaitable<T> = Promise<T> | T;

export type MultiRouteContext<
  TRoute extends Route,
  _Preserved extends TRoute = TRoute,
> = TRoute extends any
  ? MigrateContext<Simplify<SuperSets<TRoute, _Preserved, "params">>>
  : never;

export type ParamsObject = Record<string, string>;
export type InputObject = Record<PropertyKey, any>;

export type HandlerLike<
  TRoute extends Route = AnyRoute,
  Verb extends HttpVerb = HttpVerb,
> = Awaitable<OneOrMany<RouteHandler<TRoute, Verb>>>;

export type RouteHandlerResult =
  | Response
  | typeof MarkoRun.NotHandled
  | typeof MarkoRun.NotMatched
  | null
  | void;

export type RouteHandler<
  TRoute extends Route = AnyRoute,
  Verb extends HttpVerb = HttpVerb,
> = (
  context: MultiRouteContext<Extract<TRoute, { method: Verb }>>,
  next: NextFunction,
) => Awaitable<RouteHandlerResult>;

export interface Route<
  Params extends ParamsObject = ParamsObject,
  Meta = any,
  Path extends string = string,
  Verb extends HttpVerb = HttpVerb,
> {
  path: Path;
  params: Params;
  meta: NormalizedMeta<Meta, Verb>;
  method: Verb;
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

export interface AppData {}

export type Routes = [AppPaths] extends [never]
  ? Record<string, Route>
  : {
      [Path in keyof AppPaths]: Union<{
        [V in HttpVerb]: Route<
          PathParams<Path>,
          V extends keyof AppPaths[Path]["verbs"]
            ? AppPaths[Path]["verbs"][V]["def"]["meta"]
            : {},
          Path,
          V
        >;
      }>;
    };

export type AnyRoute = Routes[keyof Routes];

export type HandlerTypeFn<TRoute extends Route = AnyRoute> = [
  AppPaths,
] extends [never]
  ? <T extends HandlerLike<TRoute>>(handler: T) => T
  : <
      Params extends ParamsObject = ParamsObject,
      Meta = any,
      T extends HandlerLike<Route<Params, Meta>> = HandlerLike<
        Route<Params, Meta>
      >,
    >(
      handler: T,
    ) => T;

export type GetPaths = PathsForVerb<"GET">;
export type PostPaths = PathsForVerb<"POST">;
export type GetablePath<T extends string> = ValidatePath<GetPaths, T>;
export type GetableHref<T extends string> = ValidateHref<GetPaths, T>;
export type PostablePath<T extends string> = ValidatePath<PostPaths, T>;
export type PostableHref<T extends string> = ValidateHref<PostPaths, T>;

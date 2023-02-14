type Awaitable<T> = Promise<T> | T;
type OneOrMany<T> = T | T[];
type Combine<T> = T extends object ? { [P in keyof T]: T[P] } : T;

export interface RouteContextExtensions {}

export type ParamsObject = Record<string, string>;
export type InputObject = Record<PropertyKey, any>;

export interface RequestContext<T = unknown> {
  url: URL;
  method: string;
  request: Request;
  platform: T;
}

export type RouteContext<TRoute extends Route = Route> = TRoute extends any
  ? Combine<
      RouteContextExtensions &
        Readonly<
          RequestContext & {
            route: TRoute["path"];
            params: TRoute["params"];
            meta: TRoute["meta"];
          }
        >
    >
  : never;

export type NextFunction = () => Awaitable<Response>;

export type HandlerLike<TRoute extends Route = Route> = Awaitable<
  OneOrMany<RouteHandler<TRoute>>
>;

export type RouteHandler<TRoute extends Route = Route> = (
  context: RouteContext<TRoute>,
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

export type MatchRoute = (
  method: string,
  pathname: string
) => RouteWithHandler | null;

export type Router<T = unknown> = (
  context: RequestContext<T>
) => Promise<Response | void>;

export type InvokeRoute<T = unknown> = (
  route: Route | null,
  context: RequestContext<T>
) => Promise<Response | void>;

type Awaitable<T> = Promise<T> | T;
type OneOrMany<T> = T | T[];

export interface RouteContextExtensions {}

export interface Platform {}

export interface RequestContext<T = Platform> {
  url: URL;
  method: string;
  request: Request;
  platform: T;
}

interface RouteContextBase
  extends Readonly<RequestContext>,
    RouteContextExtensions {
  readonly url: URL;
  readonly error?: unknown;
}
export type RouteContext<
  TRoute extends Route = Route,
  Data extends RouteData = RouteData
> = TRoute extends any
  ? RouteContextBase & {
      readonly route: TRoute["path"];
      readonly params: TRoute["params"];
      readonly meta: TRoute["meta"];
      readonly data: Data;
    }
  : never;

export type NextFunction = () => Awaitable<Response>;

export type HandlerLike<
  TRoute extends Route = Route,
  Data extends RouteData = RouteData
> = Awaitable<OneOrMany<RouteHandler<TRoute, Data>>>;

export type RouteHandler<
  TRoute extends Route = Route,
  Data extends RouteData = RouteData
> = (
  context: RouteContext<TRoute, Data>,
  next: NextFunction
) => Awaitable<Response | void>;

export interface Route<
  Params extends Record<string, string> = {},
  Meta = unknown,
  Path extends string = string
> {
  path: Path;
  params: Params;
  meta: Meta;
}

export interface RouteWithHandler<
  Params extends Record<string, string> = {},
  Meta = unknown,
  Path extends string = string
> extends Route<Params, Meta, Path> {
  handler: RouteHandler<this>;
}

export type MatchRoute = (
  method: string,
  pathname: string
) => RouteWithHandler | null;

export type Router<T = Platform> = (
  context: RequestContext<T>
) => Promise<Response | void>;

export type InvokeRoute<T = Platform> = (
  route: Route | null,
  context: RequestContext<T>
) => Promise<Response | void>;

export type RouteData<
  Providing extends Record<string, any> = {},
  Existing extends Record<string, any> = {}
> = Existing & Partial<Providing>;

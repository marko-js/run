export interface RouteContext<
  Params extends Record<string, string> = {},
  Meta = unknown
> {
  request: Request;
  url: URL;
  params: Params;
  meta: Meta;
  error?: unknown;
}

export type RouteHandler<
  Params extends Record<string, string> = {},
  Meta = unknown
> = (context: RouteContext<Params, Meta>) => Promise<Response>;

export interface MatchedRoute<
  Params extends Record<string, string> = {},
  Meta = unknown
> {
  handler: RouteHandler;
  params: Params;
  meta: Meta;
  invoke(request: Request): Promise<Response>;
}

export type Router = (request: Request) => Promise<Response>;
export type RouteMatcher = (method: string, url: URL) => MatchedRoute | null;

export interface Runtime {
  router: Router,
  getMatchedRoute: RouteMatcher
}
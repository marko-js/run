import '@marko/serve/router';
import type { Runtime } from './types';

const { router, getMatchedRoute } = (globalThis as any).__MARKO_SERVE_RUNTIME__ as Runtime;
export type { MatchedRoute, RouteContext, RouteHandler, RouteMatcher, Router } from './types';
export { router, getMatchedRoute };
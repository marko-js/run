import type { MatchRoute, RequestContext, Route } from "./types";

function notImplemented(): unknown {
  throw new Error(
    "This should have been replaced by the @marko/run plugin at build/dev time"
  );
}

export const router = notImplemented as <T>(
  context: RequestContext<T>
) => Promise<Response | void>;

export const matchRoute = notImplemented as MatchRoute;

export const invokeRoute = notImplemented as <T>(
  route: Route | null,
  context: RequestContext<T>
) => Promise<Response | void>;

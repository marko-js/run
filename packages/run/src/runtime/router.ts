
import type { Handler, RouteMatcher, Router } from './types';

function notImplemented(): unknown {
  throw new Error('This should have been replaced by the @marko/run plugin at build/dev time');
}

export const handler = notImplemented as Handler;
export const router = notImplemented as Router;
export const getMatchedRoute = notImplemented as RouteMatcher;
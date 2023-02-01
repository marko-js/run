
import type { InvokeRoute, MatchRoute, Router } from './types';

function notImplemented(): unknown {
  throw new Error('This should have been replaced by the @marko/run plugin at build/dev time');
}

export const router = notImplemented as Router;
export const matchRoute = notImplemented as MatchRoute;
export const invokeRoute = notImplemented as InvokeRoute
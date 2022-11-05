import type { RouteMatcher, Router } from './types';

function none(): unknown {
  throw new Error('This should have been replaced by the @marko/serve plugin at build/dev time');
}

export const router = none as Router
export const getMatchedRoute = none as RouteMatcher;
import type { HttpVerb, Route } from "../types";

export function getVerbs(route: Route) {
  const verbs = route.handler?.verbs?.slice() || [];
  if (route.page && !verbs.includes('get')) {
    verbs.unshift('get');
  }
  return verbs;
}

export function hasVerb(route: Route, verb: HttpVerb) {
  return (verb === 'get' && route.page) || route.handler?.verbs?.includes(verb);
}
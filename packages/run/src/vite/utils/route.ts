import { httpVerbs } from "../constants";
import type { HttpVerb, Route } from "../types";

const httpVerbOrder = httpVerbs.reduce(
  (order, verb, index) => {
    order[verb] = index;
    return order;
  },
  {} as Record<HttpVerb, number>,
);

export function getVerbs(route: Route) {
  const verbs = new Set(route.handler?.verbs);
  if (route.page) {
    verbs.add("get");
  }
  if (verbs.has("get")) {
    verbs.add("head");
  }
  return [...verbs].sort((a, b) => httpVerbOrder[a] - httpVerbOrder[b]);
}

export function hasVerb(route: Route, verb: HttpVerb): boolean {
  return (
    (verb === "get" && !!route.page) ||
    route.handler?.verbs?.includes(verb) ||
    (verb === "head" && hasVerb(route, "get"))
  );
}

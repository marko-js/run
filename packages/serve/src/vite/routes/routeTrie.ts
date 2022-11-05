import type { Route, RouteTrie } from "../types";

export function createRouteTrie(routes: Route[]): RouteTrie {
  const root: RouteTrie = {
    key: "",
  };

  function insert(keys: string[], value: Route): boolean {
    let node = root;
    for (const key of keys) {
      if (key.startsWith("$$")) {
        if (!node.catchAll) {
          node.catchAll = value;
          return true;
        }
        return false;
      } else if (key.startsWith("$")) {
        node = node.dynamic ??= {
          key: "",
        };
      } else {
        node.static ??= new Map();
        let next = node.static.get(key);
        if (!next) {
          next = {
            key,
          };
          node.static.set(key, next);
        }
        node = next;
      }
    }
    if (node.route === undefined) {
      node.route = value;
      return true;
    }
    return false;
  }

  for (const route of routes) {
    const keys = route.path === "/" ? [] : route.path.split("/").slice(1);
    insert(keys, route);
  }

  return root;
}
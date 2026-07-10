import * as Run from "@marko/run/router";

export function describeMatch(method: string, pathname: string): string {
  const match = Run.match(method, pathname);
  return match ? `matched:${match.path}` : "no-match";
}

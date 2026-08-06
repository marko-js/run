import type { Context, Route, RouteDef } from "../../runtime/types";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

// The runtime only creates a body thenable for POST/PUT/PATCH requests with a
// configured validator, so a bodyless verb's `body` — reached as
// `$global.body` or `GetContext(...).body` — must read `undefined` rather
// than inviting dead `await` handling. The fully generic `Route` keeps the
// hedge, since a generic context (`ctx.parent`) may belong to a bodied route.
export type Cases = [
  Expect<Equal<Route<RouteDef<"/x", "GET">>["body"], undefined>>,
  Expect<Equal<Route<RouteDef<"/x", "HEAD">>["body"], undefined>>,
  Expect<
    Equal<Route<RouteDef<"/x", "POST">>["body"], undefined | Promise<unknown>>
  >,
  Expect<Equal<Route["body"], undefined | Promise<unknown>>>,
  Expect<Equal<Context<Route<RouteDef<"/x", "GET">>>["body"], undefined>>,
];

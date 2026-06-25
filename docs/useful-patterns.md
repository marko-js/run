# Useful Patterns

Practical recipes built from Marko Run's primitives — handlers, middleware,
layouts, pages, and meta. Each one is small on its own; combine them to build real
apps.

## Authentication / protected routes

Use a **pathless** directory (an `_`-prefixed folder) with a `+middleware` to
protect a whole section without repeating yourself or adding a URL segment.

```
src/routes/
└── _app/                  # pathless: not in the URL
    ├── +middleware.ts     # auth guard for everything under _app/
    ├── +layout.marko
    └── dashboard/
        └── +page.marko    →  /dashboard
```

```ts
// src/routes/_app/+middleware.ts
export default Run.ALL(async (ctx, next) => {
  const user = await getUserFromSession(ctx.request);
  if (!user) {
    return ctx.redirect("/login"); // idiomatic redirect helper
  }
  return next({ user }); // contribute typed `user` to context.data
});
```

> **Corrected after source review:** my first draft put protected routes in a
> parenthesized `(app)` group. That's wrong — **pathless directories use the `_`
> prefix** (`_app`). Parentheses are only for flat-route grouping. See
> [File-based Routing](./file-based-routing.md#path-segment-types).

## Redirects

The context provides redirect helpers — prefer them over hand-building responses:

```ts
export const GET = Run.GET((ctx) => ctx.redirect("/new-home"));        // 302 by default
export const POST = Run.POST((ctx) => ctx.redirect("/done", 303));     // explicit status
export const DELETE = Run.DELETE((ctx) => ctx.back("/fallback"));      // back to referer
```

- `ctx.redirect(to, status?)` resolves relative paths and defaults to a temporary
  redirect.
- `ctx.back(fallback?, status?)` redirects to the request's referer, or the
  fallback if there isn't one.

You can still return a raw `Response` if you prefer full control:

```ts
return new Response(null, { status: 308, headers: { location: "/perm" } });
```

## API routes (JSON endpoints)

Any route can be an API endpoint — export method handlers and return data. No
`+page.marko` needed.

```ts
// src/routes/api/products/+handler.ts
export const GET = Run.GET(async () => Response.json(await db.listProducts()));

export const POST = Run.POST(
  { json: ProductSchema },                 // validate the body (see Validation)
  async (ctx) => {
    const [body, issues] = await ctx.body;
    if (issues) return Response.json({ issues }, { status: 400 });
    return Response.json(await db.createProduct(body), { status: 201 });
  },
);
```

## Type-safe links with `Run.href`

> **Emphasis — added after source review.** Marko Run generates a typed `href`
> builder. Because it knows your route tree, it catches broken links and missing
> params at compile time.

```marko
<a href=Run.href("/products/$id", { params: { id: "42" } })>View product</a>
<a href=Run.href("/search", { search: { q: "shoes" } })>Search</a>
```

Plain anchors with literal URLs work too, but `Run.href` keeps links in sync with
your routes (which come from the folder structure, so moving a folder changes the
URL).

## Reading and setting cookies

The framework hands you the raw `Request`/`Response`, so anything Fetch-API works:

```ts
export const GET = Run.GET((ctx) => {
  const cookie = ctx.request.headers.get("cookie") ?? "";
  const response = new Response("ok");
  response.headers.append(
    "set-cookie",
    "session=abc123; HttpOnly; Path=/; SameSite=Lax",
  );
  return response;
});
```

## Setting response headers (caching, content type, etc.)

```ts
export const GET = Run.GET(async () =>
  Response.json(await getData(), {
    headers: { "cache-control": "public, max-age=60" },
  }),
);
```

## Error and not-found pages

Add `+404.marko` and `+500.marko` **at the root** of `src/routes` (they may only be
defined at the top level, and respond only when `Accept` includes `text/html`):

```marko
<!-- src/routes/+404.marko -->
<h1>Page not found</h1>
```

```marko
<!-- src/routes/+500.marko  (receives input.error) -->
<h1>Something went wrong</h1>
<p>${$global.error?.message}</p>
```

For "not found" deeper in the tree (e.g. "no user with that id"), return a `404`
response from a handler, or use a catch-all (`$$`) route. See
[File-based Routing](./file-based-routing.md#special-pages-404-and-500).

## Rendering a specific template from a handler

`context.render(template, input, init?)` streams any Marko template as the
response (setting `Content-Type: text/html`):

```ts
import Receipt from "./receipt.marko";

export const POST = Run.POST(async (ctx) => {
  const order = await placeOrder(ctx);
  return ctx.render(Receipt, { order }, { status: 201 });
});
```

## Embedding Marko Run in an existing server

Marko Run exposes its runtime so you can mount it inside another server (e.g.
Express). Import from `@marko/run/router`:

```ts
import express from "express";
import * as Run from "@marko/run/router";

express().use(async (req, res, next) => {
  const request = /* build a WHATWG Request from req */;
  const response = await Run.fetch(request, { req, res });
  if (response) {
    // apply `response` to `res`
  } else {
    next();
  }
});
```

`Run.match(method, pathname)` and `Run.invoke(route, request, platform)` give you
finer control when you need to know whether a route matched before invoking it.

## Choosing an adapter for deployment

The same app deploys to different targets by configuring an adapter in
`vite.config.js`. Official adapters: **node**, **static**, and **netlify**. Pick
one for your host and build with `marko-run build`. See
[Getting Started](./getting-started.md#configure-vite).

## Next steps

- [Data Loading](./data-loading.md) and [Validation](./validation.md) round out the
  server-side story.
- [File-based Routing](./file-based-routing.md) is the reference these patterns
  build on.

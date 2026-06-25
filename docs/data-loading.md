# Data Loading

Marko Run loads data on the server inside **handlers** and **middleware**, then
makes it available to your **page** for rendering. There are two ways to get data
to a page, and after reviewing the source it's clear the **first one below is the
intended, first-class path** — give it the emphasis.

## 1. The first-class way: `next(data)` → `context.data`

A handler or middleware receives `(context, next)`. Call `next(data)` with a plain
object and that data is merged onto the **context** and exposed to the page as
`$global.data`:

```ts
// src/routes/products/$id/+handler.ts
export const GET = Run.GET(async (ctx, next) => {
  const product = await db.getProduct(ctx.params.id);
  return next({ product }); // contributes `product` to context.data
});
```

```marko
<!-- src/routes/products/$id/+page.marko -->
<h1>${$global.data.product.name}</h1>
<p>${$global.data.product.description}</p>
```

> **Run vs MarkoRun.** `Run` is a per-route-file namespace the Vite plugin injects
> into every routable file — you do **not** import it. It is typed specifically for
> that file's route(s), so `ctx.params`, `ctx.data`, etc. are all correctly typed.
> An older global `MarkoRun` namespace still exists but is **deprecated in the
> source** (`/** @deprecated use Run namespace instead */`). Prefer `Run`.

### Data from middleware is merged in too

Middleware uses `Run.ALL` (it runs for every method) and can contribute data the
same way. Marko Run **merges** the data from every middleware and the handler into
a single `context.data`:

```ts
// src/routes/_app/+middleware.ts
export default Run.ALL(async (ctx, next) => {
  const user = await getUserFromSession(ctx.request);
  return next({ user }); // adds `user` to context.data for everything nested
});
```

Now nested pages can render `$global.data.user` **and** `$global.data.product`,
each correctly typed, because the framework knows which middleware/handlers ran
for the route.

### POST handlers can render the page with data, too

A `+page.marko` is served for `GET`, but a `POST` handler that calls `next(data)`
will **also render the page** (with the new data). This makes the classic
form-submit-then-show-result flow work without a redirect:

```ts
export const POST = Run.POST(async (ctx, next) => {
  const result = await doSomething(ctx);
  return next({ result }); // re-renders the page with `result` in $global.data
});
```

## 2. The lightweight way: read context directly via `$global`

The request **context** is exposed to Marko templates as `$global`. Plain function
handlers still work, and anything already on the context — `params`, `search`,
validated `body`, `meta` — is readable from `$global` without `next(data)`:

```marko
<!-- a page that just echoes route info -->
<pre>${JSON.stringify({ params: $global.params, search: $global.search })}</pre>
```

> **Confirmed against the source:** `context` *is* `$global` in pages. The
> `Context` interface (`packages/run/src/runtime/types.ts`) exposes `route`,
> `method`, `meta`, `params`, `search`, `body`, `data`, `url`, `request`,
> `platform`, `serializedGlobals`, and `parent`, plus the helper methods `fetch`,
> `render`, `redirect`, and `back`.

## Handling "not found"

If the data doesn't exist, return a response (or one of the special signals)
instead of rendering:

```ts
export const GET = Run.GET(async (ctx, next) => {
  const product = await db.getProduct(ctx.params.id);
  if (!product) {
    return new Response("Not found", { status: 404 });
  }
  return next({ product });
});
```

## Async rendering and streaming

Because Marko streams SSR output, you can hand the page a **promise** and let it
resolve while the shell streams. Put the promise in your data and resolve it in the
page with Marko's `<await>`:

```ts
export const GET = Run.GET((ctx, next) =>
  next({ productPromise: db.getProduct(ctx.params.id) }), // not awaited
);
```

```marko
<await(product=$global.data.productPromise)>
  <h1>${product.name}</h1>
</await>
```

## Client data and serialization

SSR data lives on the server. Anything the browser needs (for components that
hydrate) must be **serialized** into the page. The context exposes
`serializedGlobals` (a `Record<string, boolean>`) to control which globals are
sent to the client. Be deliberate:

- Don't serialize secrets, DB handles, or large objects you don't need on the
  client.
- Prefer passing only what a component needs as component `input`, which Marko
  serializes as part of hydration.

## Typing custom context properties

`context.data` is typed automatically from your `next(data)` calls. For
cross-cutting values you attach elsewhere (or platform values from an adapter),
extend Marko Run's types with **module augmentation** — not a global namespace:

```ts
// src/types.d.ts
declare module "@marko/run" {
  interface Platform {
    // values your adapter provides on context.platform
    region?: string;
  }
}

export {};
```

> **Corrected after source review:** my first draft used
> `declare global { namespace MarkoRun { interface Context } }`. The project's own
> pattern (README + generated `routes.d.ts`) is module augmentation on
> `@marko/run`, e.g. `declare module "@marko/run" { interface Platform {} }`.

## Next steps

- [Validation](./validation.md) — validate `params`, `search`, and request bodies,
  which feeds the typed `context` used here.
- [Useful Patterns](./useful-patterns.md) — auth, redirects, and more.

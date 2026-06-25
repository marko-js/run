# File-based Routing

In Marko Run, the folder structure under `src/routes` defines your application's
URLs. There is no route table to maintain — you create folders and special files,
and the framework builds the router for you.

> The routes directory defaults to `./src/routes` (relative to your Vite config).
> Change it with the plugin's `routesDir` option:
> `marko({ routesDir: "src/pages" })`.

## The basics

- **Folders create path segments.** `src/routes/about/` maps to `/about`.
- **Special files define behavior.** A folder becomes routable when it contains a
  special file such as `+page.marko` (a page) or `+handler.ts` (a handler).
- **Special files are prefixed with `+`.** This keeps them distinct from ordinary
  components you can colocate in the same folder.

```
src/routes/
├── +page.marko            →  /
├── about/
│   └── +page.marko        →  /about
└── blog/
    ├── +page.marko        →  /blog
    └── posts/
        └── +page.marko    →  /blog/posts
```

## Pages

`+page.marko` is the UI rendered for a route's URL. It is served for **`GET`**
requests with HTML. Only one page may exist per served path.

```marko
<!-- src/routes/about/+page.marko  →  /about -->
<h1>About us</h1>
```

## Layouts

`+layout.marko` wraps the page in the same folder and all nested routes. Layouts
nest with the folder structure, composing outermost → innermost. A layout renders
its nested content via `input`:

```marko
<!-- src/routes/+layout.marko -->
<!doctype html>
<html lang="en">
  <body>
    <nav>…</nav>
    <${input.renderBody}/>
  </body>
</html>
```

> **Emphasis (version-dependent):** with Marko's class API (Marko 5) the slot is
> `input.renderBody`, so you write `<${input.renderBody}/>`. With the tags API
> (Marko 6) the generated layout `Input` uses `content` instead. The Vite plugin
> generates the correct `Input` type for your layout — let your editor confirm
> which one applies.

## Path segment types

Within `src/routes`, each directory name is one of four types:

1. **Static** — the default. The directory name becomes a path segment.
   `users/` → `/users`.

2. **Pathless** — a directory whose name starts with an underscore (`_`). It is
   **ignored** in the URL; it exists only to scope a layout/middleware or to
   organize files. `_app/dashboard/` → `/dashboard`.

   > **Corrected after source review — this is the single biggest fix.** My first
   > draft claimed pathless groups used parentheses `(group)`. That is wrong:
   > **pathless directories use the `_` prefix.** Parentheses mean something else
   > entirely (flat-route grouping — see below).

3. **Dynamic** — a directory whose name starts with a single `$`. It matches any
   single segment and captures it as a param. `$id/` → `/:id`, available as
   `context.params.id`. A directory named exactly `$` matches a segment **without**
   capturing it.

4. **Catch-all** — a directory whose name starts with `$$`. It matches the rest of
   the path as one param. `$$rest/` → matches `/a/b/c` with
   `context.params.rest === "a/b/c"`. A directory named exactly `$$` matches
   without capturing. Catch-all directories consume the rest of the path, so you
   **cannot nest** routes inside them — which makes them perfect for `404`-style
   routes at any level.

```
src/routes/
├── _app/                 # pathless: not in the URL
│   ├── +layout.marko
│   └── dashboard/
│       └── +page.marko   →  /dashboard
├── products/
│   └── $id/
│       └── +page.marko   →  /products/:id
└── files/
    └── $$path/
        └── +page.marko   →  /files/*  (e.g. /files/a/b/c)
```

## Flat routes

> **Emphasis — a whole feature my first draft missed.** You don't need a folder per
> segment. **Flat routes** let you encode segments in a single file or folder name
> using periods (`.`). Anything before the `+` in a routable filename is treated as
> the flat path.

These are equivalent:

```
routes/projects/$projectId/members/+page.marko      # nested folders
routes/projects.$projectId.members+page.marko        # flat
```

Each `.`-delimited segment follows the same static/pathless/dynamic rules. You can
mix flat and nested freely; they're merged together.

### Multiple paths, groups, and optional segments

- **Multiple paths** — separate alternatives with a comma (`,`):
  `members,people+page.marko` matches both `…/members` and `…/people`.
- **Grouping** — parentheses `( )` group alternatives within a flat route:
  `projects.$projectId.(members,people)+page.marko`. (This is what parentheses are
  for — **not** pathless routes.)
- **Optional segments** — include an empty or pathless alternative:
  `projects.(home,)+page.marko` matches `/projects` and `/projects/home`.

### Escaping control characters

To use a literal `.`, `,`, `+`, `(`, `)`, `$`, or `_` in a path, wrap it in
backticks (graves). For `/sitemap.xml`:

```
routes/sitemap`.`xml+handler.ts
```

## Handlers

`+handler.{js,ts}` defines server logic for a route. It can handle the HTTP
methods `GET`, `HEAD`, `POST`, `PUT`, `DELETE`, `PATCH`, and `OPTIONS`. There are
two ways to write a handler.

**Plain function** (simple; still fully supported):

```ts
export function GET(context, next) {
  return Response.json({ ok: true });
}
```

**`Run.<VERB>(...)`** (the first-class form — adds typed validation and data):

```ts
export const GET = Run.GET((ctx, next) => {
  return next({ items: [] }); // contribute typed data to the page
});

export const POST = Run.POST(
  { json: schema },          // options: validation (see Validation doc)
  async (ctx) => { /* … */ },
);
```

- A handler may **return** or **throw** a WHATWG `Response`.
- Returning `undefined` automatically calls `next()` for you.
- An export may also be an **array of handlers** (composed in order) or a promise
  resolving to one.
- Special return signals exist: `Run.NotHandled` (you wrote to the platform's raw
  response yourself) and `Run.NotMatched` (treat as if no route matched → 404).

### The context object

Verified against `packages/run/src/runtime/types.ts`, the context exposes:

| Property | What it is |
| --- | --- |
| `request` | The WHATWG `Request`. |
| `url` | Parsed `URL`. |
| `method` | HTTP method string. |
| `route` | The matched route path pattern. |
| `params` | Captured (and validated) path params. |
| `search` | Validated query params. |
| `body` | `Promise<[value, issues]>` for validated `POST`/`PUT`/`PATCH` bodies. |
| `data` | Merged data from `next(data)` calls (see Data Loading). |
| `meta` | Metadata from `+meta`. |
| `platform` | Adapter-specific values. |
| `serializedGlobals` | Controls which globals serialize to the client. |
| `parent` | Parent context when `context.fetch` created this one. |

Plus helper **methods**: `fetch(resource, init)`, `render(template, input, init)`,
`redirect(to, status?)`, and `back(fallback?, status?)`.

> **Emphasis:** my first draft listed only `request`/`url`/`params`/`meta`/`platform`
> and missed the helper methods. `context.redirect` and `context.back` in
> particular are the idiomatic way to redirect — see
> [Useful Patterns](./useful-patterns.md#redirects).

## Middleware

`+middleware.{js,ts}` runs before the handler and page for its folder and
everything nested under it, for **all** HTTP methods. Use the `Run.ALL` form (or a
plain default-exported function):

```ts
export default Run.ALL(async (ctx, next) => {
  const response = await next(); // continue down the chain
  return response;
});
```

Call `next()` to continue (or `next(data)` to also contribute data); return early
to short-circuit (e.g. an auth redirect).

## Meta

`+meta.{js,ts,json}` attaches static metadata to a route, surfaced on
`context.meta`. When meta is an object, it supports **verb-specific overrides**:
top-level keys named after HTTP methods are merged into the base for that method.

```json
// +meta.json
{ "name": "Default", "POST": { "name": "On POST" }, "GET": { "name": "On GET" } }
```

A `GET` sees `{ name: "On GET" }`; a `POST` sees `{ name: "On POST" }`; any other
method sees `{ name: "Default" }`.

## Special pages: 404 and 500

> **Corrected after source review:** these may only be defined at the **top level**
> of `src/routes` (they're subject to the root layout), and they only respond when
> the request's `Accept` header includes `text/html`.

- `+404.marko` — rendered (status `404`) when no other handler/page handled the
  request. For finer-grained "not found" at deeper levels, use a catch-all (`$$`)
  route.
- `+500.marko` — rendered (status `500`) when an uncaught error occurs. Its
  generated `Input` includes `error: unknown`, so you can show details:
  `<p>${$global.error?.message}</p>`.

## Execution order

For a request like `/about`, routable files run in this order:

1. **Middleware**, root-most → leaf-most (each calls `next()`).
2. **Handler** for the request's method.
3. **Layouts**, root-most → leaf-most.
4. **Page**.

Layouts and the page are combined at build time into a single component, and the
response streams back out.

## Route matching and precedence

When more than one route could match, more **specific** wins: static segments beat
dynamic (`$`), which beat catch-all (`$$`). So a literal `products/new` resolves
before a dynamic `products/$id`.

## Next steps

- [Data Loading](./data-loading.md) — get data from handlers into pages.
- [Validation](./validation.md) — validate params, search, and bodies.
- [Useful Patterns](./useful-patterns.md) — practical recipes.

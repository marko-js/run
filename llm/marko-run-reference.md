# @marko/run Reference & Guidance (v0.11.4)

Comprehensive, source-verified reference for @marko/run, Marko's file-based-routing
meta-framework (Vite-powered). Verified against `packages/run` source
(`src/vite/routes/*`, `src/runtime/*`, `src/cli/*`), its test fixtures, adapters,
and live dev-server testing. Works with marko 5–6 (peer `marko: "5 - 6"`); examples
here use Marko 6 (tags API).

---

## 1. Setup & CLI

```sh
npm install @marko/run        # marko is a peer dependency
```

Zero config: with just `src/routes/+page.marko`, `npm exec marko-run` serves
http://localhost:3000. The CLI supplies a default Vite config + node adapter when
no `vite.config.*` exists.

| Command                               | Notes                                                          |
| ------------------------------------- | -------------------------------------------------------------- |
| `marko-run` / `marko-run dev [entry]` | dev server, watch mode. `-p/--port` (default `$PORT` or 3000)  |
| `marko-run build [entry]`             | production build (SSR build then client build). `-o/--output`  |
| `marko-run preview [entry]`           | build **then** serve production build. `-p`, `-o`, `-f/--file` |

Both commands accept `-c/--config <vite config>` and `-e/--env <dotenv file>`.
`[entry]` is an optional custom server entry (e.g. `marko-run src/index.ts` for an
Express app).

Explicit Vite config:

```ts
/* vite.config.ts */
import { defineConfig } from "vite";
import marko from "@marko/run/vite";

export default defineConfig({
  plugins: [
    marko({
      /* routesDir, adapter, trailingSlashes, ... */
    }),
  ],
});
```

Plugin options: `routesDir` (default `"src/routes"`), `adapter`,
`trailingSlashes: "Ignore" | "RedirectWithout" (default) | "RedirectWith" |
"RewriteWithout" | "RewriteWith"`, `emitRoutes`, plus all `@marko/vite` options.

## 2. Routable files

Only `+`-prefixed filenames inside the routes directory are routable:

| File            | Purpose                                                          | Extensions                  |
| --------------- | ---------------------------------------------------------------- | --------------------------- |
| `+page.marko`   | GET/HEAD page at the directory's path (one per path)             | `.marko` only               |
| `+layout.marko` | wraps nested layouts/pages                                       | `.marko` only               |
| `+handler.*`    | request handlers (`GET`/`POST`/…) at the path                    | any (`.js`/`.ts`/…)         |
| `+middleware.*` | runs before handlers for **all** methods, root→leaf              | any                         |
| `+meta.*`       | static metadata attached to `context.meta`                       | any (e.g. `.json`, `.ts`)   |
| `+404.marko`    | fallback when nothing handled & `Accept: text/html` (status 404) | root of routes dir **only** |
| `+500.marko`    | uncaught error page (status 500); receives `input.error`         | root of routes dir **only** |

- Names are case-insensitive; an extra dotted segment is allowed (`+handler.get.ts`).
- Nested `+404`/`+500` files are ignored with a warning. Both are wrapped by the
  **root** layout.
- A `HEAD` request to a page-only route is auto-derived from GET (body stripped).

### Layouts

```marko
/* src/routes/+layout.marko (Marko 6) */
export interface Input { content: Marko.Body }

<nav>...</nav>
<main>
  <${input.content}/>     // the nested layout/page renders here
</main>
```

Marko 5 (class API) layouts use `<${input.renderBody}/>` instead; the plugin
auto-detects which API from the layout file. Layouts nest root→leaf and are just
components — no other constraints. Request info comes from `$global` (below).

### Handlers

```js
/* src/routes/things/+handler.js */
export function GET(context, next) {
  // do work before the page renders
  return next({ things: loadThings() }); // -> $global.data.things in the page
}

export async function POST(context, next) {
  const form = await context.request.formData();
  // ...
  return context.redirect("/things", 303);
}
```

- Valid verb exports: **UPPERCASE** `GET`, `HEAD`, `POST`, `PUT`, `DELETE`,
  `PATCH`, `OPTIONS` (no `connect`/`trace`; lowercase exports are ignored with a
  build warning).
- Each export may be a handler function, an **array** of handlers (composed in
  order), or a promise of either.
- Newer wrapper API (adds validation & typing; `Run` is an injected global):
  `export const POST = Run.POST(handler)`, `Run.POST([mw, handler])`,
  `Run.POST(options, handler)`, and `Run.ALL(...)` for middleware. Options can
  validate/coerce `params`, `search`, `json`, `form` (functions or Standard
  Schemas; sync only) — validated bodies arrive at `context.body`.

**Handler contract**

- Return a `Response` → that is the response; the page does **not** render.
- Return `undefined`/nothing → `next()` is called automatically (renders the page
  for GET/HEAD/POST when one exists, else 204 for other verbs).
- Call `next()` yourself to do work around the page render — you **must return
  (or throw) its result**, or dev warns and `next` runs twice.
- `next(data)` merges `data` into `context.data`; templates read `$global.data`.
- You may throw a `Response` anywhere to short-circuit.
- Handlers created with `Run.<VERB>()` are skipped (auto-`next`) for other methods.

### Middleware

```js
/* src/routes/+middleware.js */
export default async function (context, next) {
  const start = performance.now();
  try {
    return await next(); // ALWAYS return/await it
  } finally {
    console.log(
      context.request.method,
      context.url.pathname,
      performance.now() - start,
    );
  }
}
```

- `default` export (function/array/promise); runs for **every** method, root→leaf,
  before handlers. Same contract as handlers (`next(data)`, return Responses).
- Response post-processing pattern: `const res = await next(); res.headers.append("set-cookie", ...); return res;`

### Execution order (request → response)

```
middlewares (root → leaf) → +handler verb → layouts (root → leaf) → +page
```

The page/layout chain is what `next()` produces for GET/HEAD/POST with a page.

## 3. Path structure (directories)

| Directory name | Kind      | Effect                                                                                                                  |
| -------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `users`        | static    | literal segment `/users` (matching is case-sensitive)                                                                   |
| `_private`     | pathless  | no URL segment; scopes layouts/middleware                                                                               |
| `$id`          | dynamic   | matches one segment; `context.params.id` (bare `$` matches without capturing)                                           |
| `$$rest`       | catch-all | matches remainder; `params.rest` (bare `$$` uncaptured). **Terminal** — nothing may nest under it. Use for scoped 404s. |

## 4. Flat routes

Encode segments in file/dir names with `.` — everything before `+` is the route:

```
src/routes/
  projects.$projectId.members+page.marko     →  /projects/:projectId/members
  projects.$projectId/                       →  same, as a folder
    members+page.marko
```

- `,` = alternates: `members,people+page.marko` serves both paths.
- Groups: `(members,people)` — combinatorial expansion, nestable.
- Optional segment: empty alternate — `projects.(home,)+page.marko` matches
  `/projects` and `/projects/home` (`(home,_x)` = pathless variant that can scope
  its own middleware).
- Escape literal control chars with backticks: ``sitemap`.`xml+page.marko`` → `/sitemap.xml`.
- Flat and directory forms merge; duplicate pages/handlers for one expanded path
  are a **build error** ("Duplicate routes for path ...", "route ... is ambiguous").

## 5. The context object

Same object in handlers/middleware (`context`) and templates (**`$global`**):

| Property            | Description                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `request`           | WHATWG `Request` (`request.formData()`, `.json()`, headers…)                                              |
| `url`               | parsed `URL` (`url.pathname`, `url.searchParams`)                                                         |
| `params`            | path params from `$`/`$$` segments (lazy; validated if options given)                                     |
| `search`            | `url.searchParams` as a plain object (repeats → arrays)                                                   |
| `meta`              | merged `+meta` data for the route (`{}` if none). Meta objects may nest per-verb keys that shallow-merge. |
| `data`              | accumulator for `next(data)` — read in templates via `$global.data`                                       |
| `body`              | validated body (only when `json`/`form` options configured; re-readable thenable)                         |
| `route` / `method`  | matched route path pattern / HTTP method                                                                  |
| `platform`          | adapter-specific (node: `{ request: IncomingMessage, response: ServerResponse }`)                         |
| `parent`            | parent context when the request came from a nested `context.fetch`                                        |
| `serializedGlobals` | which `$global` props are sent to the browser; defaults `{ params: true, url: true }`                     |

Methods:

- `context.render(template, input, init?)` → `Response` streaming any Marko
  template (default 200, `text/html`). Custom pages: `ctx.render(ErrorPage, { title })`.
- `context.redirect(to, status = 302)` → redirect `Response`; status must be
  301/302/303/307/308 (else `RangeError`). Relative paths resolve against `url`.
- `context.back(fallback = "/", status?)` → redirect to the `referer` header or fallback.
- `context.fetch(resource, init?)` → run another request through the router
  in-process (single-flight pattern: `return context.fetch(context.url)` from a
  POST handler re-renders the page with updated data in the same round trip).

In `.marko` route files: `$global.params.id`, `$global.url.pathname`,
`$global.data.user`, `$global.meta`, `$global.search`. Custom properties stuck on
the context in middleware (`context.user = ...` + module augmentation) are visible
as `$global.user`, but are **not serialized to the browser** unless added to
`serializedGlobals`.

## 6. Typed URLs — `Run.href`

```marko
<a href=Run.href("/thing/$id", { params: { id: 1 }, search: { q: "foo" }, hash: "top" })>
```

Type-checked against the app's route table; statically-analyzable calls are
compile-time replaced with plain strings in client bundles. `params` is required
exactly when the path has `$` segments; catch-all params accept arrays.

## 7. Programmatic runtime & custom servers

```ts
import { fetch, match, invoke } from "@marko/run/router";

const response = await fetch(request, platform); // full router pass
const matched = match(request.method, url.pathname); // sync route lookup
const response = await invoke(matched, request, platform);
```

Node/Express middleware (from the node adapter):

```ts
/* src/index.ts — start with: marko-run src/index.ts */
import express from "express";
import { routerMiddleware } from "@marko/run-adapter-node/middleware";

express()
  .use(routerMiddleware())
  .listen(process.env.PORT ?? 3000);
```

Also exported: `matchMiddleware()` + `invokeMiddleware()` (split matching from
invocation, e.g. to interleave other Express routes), `importRouterMiddleware()`,
`createMiddleware(fetch, { origin, trustProxy })`. Default origin from `$ORIGIN`,
proxy header trust via `TRUST_PROXY=1`.

## 8. Adapters

Auto-detected from `package.json` dependencies matching `@marko/run-adapter*`
(fallback: built-in node adapter). Explicit: `marko({ adapter: someAdapter() })`.

- **`@marko/run-adapter-node`** — production Node server (default-entry serves
  `/assets` + `/public` statics with immutable caching) or Express middleware mode.
- **`@marko/run-adapter-static`** — pre-renders every param-less route (plus
  `urls: string[] | routes => string[]` extras) into `dist/public`; honors `+404`;
  preview via `sirv`.
- **`@marko/run-adapter-netlify`** — Netlify Functions, or Edge with
  `netlifyAdapter({ edge: true })`; `netlify.toml` points `publish = "dist/public"`,
  `command = "marko-run build"`.

## 9. TypeScript

- Global namespace **`Run`** (current; `MarkoRun.*` still works but is deprecated):
  `Run.Context`, `Run.Handler`, `Run.Route`, plus the runtime helpers
  `Run.GET…Run.OPTIONS`, `Run.ALL`, `Run.href`.
- Extend the context/platform via module augmentation:

```ts
declare module "@marko/run" {
  interface Context {
    user?: User;
  }
  interface Platform {
    customProp: Thing;
  }
}
```

- With a `tsconfig.json` present, every build (including dev) regenerates
  `.marko-run/routes.d.ts` with per-file `Run.Context`/`Run.Route` narrowed to the
  exact routes each file serves (params, meta, `next()` data flow, `Run.href`
  path completion). Add it to `tsconfig` `include`.

## 10. Best practices

- Progressive enhancement first: plain `<form method="post">` + a `POST` handler
  that `context.redirect(..., 303)`s (PRG) or `return context.fetch(context.url)`
  (single flight) — no client JS required.
- Load data in `+handler.js`/`+middleware.js` with `next({ data })` and read
  `$global.data` in the page; keep pages presentation-only.
- Put shared chrome in `+layout.marko`; use pathless `_dirs` (or `(a,_b)` groups)
  to scope middleware/layouts without affecting URLs.
- One concern per file: middleware for cross-cutting (auth, logging, headers),
  handlers for verbs/data, pages for markup.
- Use `context.redirect`/`back` instead of hand-rolled `Response`s (status
  validation + relative URL resolution for free).
- Custom 404s: root `+404.marko` for the site; `$$rest` catch-all pages for
  scoped "not found" UIs (remember they're terminal).
- Return JSON from handlers with `new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } })`
  (or `Response.json(x)`).

## 11. Foot-gun quick list

1. Verb exports must be exact UPPERCASE (`export function GET`); `get`/`Get` are
   silently non-routable (build warning only).
2. Middleware must be the `default` export.
3. Return/throw `next()`'s result — dropping it makes the framework call `next`
   again (dev warns).
4. A handler that always returns its own `Response` never renders the page.
5. `+404.marko`/`+500.marko` work only at the routes root; nested ones are ignored.
6. Params/data in templates come from `$global` (`$global.params.id`), not `input`
   — page `input` is empty (layouts get `input.content` only).
7. `context.redirect` throws on statuses outside 301/302/303/307/308.
8. Catch-all `$$` dirs are terminal — no nested routable files.
9. Trailing-slash URLs redirect to the slash-less form by default (configure
   `trailingSlashes` if you need otherwise); static matching is case-sensitive.
10. Only `params` and `url` are serialized to the browser by default; other
    `$global` props need `serializedGlobals`.
11. Custom context props need module augmentation for types (`declare module "@marko/run"`).
12. Zero-config only works through the `marko-run` CLI; bare `vite` needs the
    plugin in a config file.
13. `+meta` non-object verb keys are dropped from the merged base; default `meta`
    is `{}`.
14. Layout content prop is API-specific: Marko 6 `input.content`, Marko 5
    `input.renderBody` — don't mix.
15. Validators (Standard Schema) must be synchronous; async schemas throw.

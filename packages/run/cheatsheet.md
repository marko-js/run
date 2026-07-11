# @marko/run cheat sheet (file-based routing)

Routes live under `src/routes/`. Only `+`-prefixed files are routable. Dev server: `marko-run dev`.

## Files

| File                        | Role                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+page.marko`               | the page served at this directory's path (GET)                                                                                                     |
| `+layout.marko`             | wraps everything below it; layouts NEST — every `+layout.marko` up the tree wraps the next, root→leaf. Render the child with `<${input.content}/>` |
| `+handler.js`               | HTTP handlers: `export const GET = Run.GET((ctx, next) => ...)` — verb names MUST be UPPERCASE; `Run` is a global, no import                       |
| `+middleware.js`            | `export default Run.ALL((ctx, next) => ...)` — runs before handlers, all methods, root→leaf                                                        |
| `+404.marko` / `+500.marko` | root of `src/routes/` only                                                                                                                         |

## Paths

- `src/routes/about/+page.marko` → `/about`
- `src/routes/products/$id/+page.marko` → `/products/:id` (param `id`)
- `$$rest` dir → catch-all; `_name` dir → no URL segment (grouping)
- Flat form: `.` is the directory separator, so `products.$id+page.marko` ≡ `products/$id/+page.marko`; mix flat and nested freely.
- One file can serve several paths: `,` lists alternates and `()` groups them. `foo,bar+page.marko` → `/foo` and `/bar`; `(a,b).(c,d)+handler.js` → `/a/c`, `/a/d`, `/b/c`, `/b/d`. Escape a literal `.` / `$` / `,` with backticks: `` `1.0`+page.marko `` → `/1.0`.
- Relative imports from a route file: one `../` per directory after `src/`. From `src/routes/+page.marko` use `../x.js` for `src/x.js`; from `src/routes/a/+page.marko` use `../../x.js`; from `src/routes/a/$b/+handler.js` use `../../../x.js`. Count the directories — off-by-one here is the top import error.

## Request data

- In handlers/middleware: the `ctx` argument.
- In `.marko` pages/layouts: the same object is **`$global`** (NOT `input` — page input is empty).

```marko
/* src/routes/products/$id/+page.marko */
<h1>Product ${$global.params.id}</h1>
<p>query q = ${$global.url.searchParams.get("q")}</p>
<p>from handler: ${$global.data.title}</p>
```

Context/`$global` properties: `request` (WHATWG Request), `url` (URL), `params`, `search`, `body` (only on POST/PUT/PATCH with a `json`/`form` validator; `await` it), `meta`, `data`, `platform`. Methods: `ctx.render(template, input)`, `ctx.redirect(path, status)` (301/302/303/307/308 only), `ctx.back()`, `ctx.fetch(url)`.

## Handler contract

```js
/* src/routes/guestbook/+handler.js */
import { z } from "zod";

import { addEntry, loadEntries } from "../../store.js";

export const GET = Run.GET((ctx, next) => {
  return next({ title: "Guestbook", entries: loadEntries() }); // next() renders the page; data -> $global.data
});

export const POST = Run.POST(
  { form: z.object({ message: z.string().trim().min(1) }) },
  async (ctx, next) => {
    const [body, issues] = await ctx.body;
    if (issues) {
      // Re-render the page with the error (and prior data) instead of a bare 400.
      return next({ entries: loadEntries(), error: "Message can't be empty" });
    }
    addEntry(body.message);
    return ctx.redirect("/guestbook", 303); // POST-redirect-GET
  },
);
```

- `Run.GET`/`Run.POST`/… wrap the handler (and skip it for other methods); `Run.ALL` runs for every method. Legacy plain exports (`export function GET(ctx, next) {}`) still work but new code uses `Run.*`.
- Validate inputs by declaring validators in an options object: `params` and `search` on any verb, the body via `json` or `form` (there is no `body` option key). Use any Standard Schema validator (zod, valibot, ...) or a plain coercion function.
- Schema-validated values are `[value, issues]` pairs: `const [search, searchIssues] = ctx.search`, `const [params, paramIssues] = ctx.params`, `const [body, issues] = await ctx.body`. When validation fails `issues` is set (and `value` is the raw input) — handle it before use (reject, or re-render the page as in the POST above). Where validators are declared, read these accessors instead of re-parsing `ctx.url.searchParams` or `ctx.request.formData()`.
- Return a `Response` → sent as-is (page does not render).
- Return nothing → framework calls `next()` for you (page renders).
- If you call `next()` yourself, RETURN its result.
- Load page data HERE, and pass promises unawaited: `next({ entries: loadEntries() })` streams the page shell immediately and the page renders `<await|entries|=$global.data.entries>` when it resolves. Awaiting in the handler delays the first byte; fetching inside components creates waterfalls.
- JSON APIs: `return Response.json(obj)` (add status/headers with `Response.json(obj, { status: 201 })`); it sets `content-type: application/json` for you.

## Middleware (auth/logging, written once for a subtree)

```js
/* src/routes/admin/+middleware.js */
export default Run.ALL((ctx, next) => {
  if (ctx.url.searchParams.get("key") !== "letmein") {
    return new Response("unauthorized", { status: 401 });
  }
  return next();
});
```

## Layout

```marko
/* src/routes/+layout.marko */
<header><nav><a href="/">Home</a> <a href="/about">About</a></nav></header>
<main><${input.content}/></main>
```

Layouts nest: `src/routes/+layout.marko` and `src/routes/admin/+layout.marko` BOTH wrap `/admin/...` pages (outermost first). Middleware nests the same way, root→leaf.

Typed links: `<a href=Run.href("/products/$id", { params: { id } })>` (checked against your routes).

Plain `<form method="post">` + a POST handler + redirect = zero-JS forms that just work.

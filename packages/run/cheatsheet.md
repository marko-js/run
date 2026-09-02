# @marko/run cheat sheet

Routes live under `src/routes/`. Only `+`-prefixed files are routable. Dev server: `marko-run dev`.

## Files

| File                        | Role                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+page.marko`               | the page at this directory's path; `next()` renders it for GET, POST and QUERY                                                                     |
| `+layout.marko`             | wraps everything below it. Layouts nest: every `+layout.marko` up the tree wraps the next, root→leaf. Render the child with `<${input.content}/>`  |
| `+handler.js`               | HTTP handlers: `export const GET = Run.GET((ctx, next) => ...)`. Verb names are uppercase; `Run` is a global, no import                            |
| `+middleware.js`            | `export default Run.ALL((ctx, next) => ...)` runs before handlers, root→leaf. `Run.ALL` covers every method; `Run.POST(...)` is skipped for others |
| `+404.marko` / `+500.marko` | root of `src/routes/` only, wrapped by the root layout; `+500` gets `input.error`. A `$$` dir 404s deeper                                          |

## Paths

- `src/routes/about/+page.marko` → `/about`
- `src/routes/products/$id/+page.marko` → `/products/:id` (param `id`)
- `$$rest` dir → catch-all (nothing nests inside it); bare `$`/`$$` match without capturing; `_name` dir → no URL segment (grouping)
- Flat form: `.` is the directory separator, so `products.$id+page.marko` ≡ `products/$id/+page.marko`; mix flat and nested freely.
- One file can serve several paths: `,` lists alternates and `()` groups them. `foo,bar+page.marko` → `/foo` and `/bar`; `(a,b).(c,d)+handler.js` → `/a/c`, `/a/d`, `/b/c`, `/b/d`; an empty alternate is optional (`projects.(home,)` → `/projects`, `/projects/home`). Escape a literal `.` `,` `+` `(` `)` `$` `_` with backticks: `` `1.0`+page.marko `` → `/1.0`.

## Request data

- In handlers/middleware: the `ctx` argument.
- In `.marko` pages/layouts: the same object is **`$global`**; page `input` is empty.

In `src/routes/products/$id/+page.marko`:

```marko
<h1>Product ${$global.params.id}</h1>
<p>query q = ${$global.search.q}</p>
<p>from handler: ${$global.data.title}</p>
```

Context/`$global` properties: `request` (WHATWG Request), `url` (URL), `route` (pattern), `method`, `params`, `search` (parsed query object, repeated keys as arrays), `body` (promise; only with a `json`/`form` validator on POST/PUT/PATCH/QUERY; `await` it), `meta`, `data`, `platform`, `parent` (caller under `ctx.fetch`), `serializedGlobals` (props the browser's `$global` gets; `params`/`url` by default). Methods: `ctx.render(template, input)`, `ctx.redirect(to, status = 302)` (301/302/303/307/308 only), `ctx.back(fallback = "/")` (uses `Referer`), `ctx.fetch(resource, init?)` (through the app router).

## Handler contract

In `src/routes/guestbook/+handler.js`:

```js
import * as v from "valibot";

import { addEntry, loadEntries } from "../../store.js";

export const GET = Run.GET((ctx, next) => {
  return next({ title: "Guestbook", entries: loadEntries() }); // next() renders the page; data merges into $global.data
});

export const POST = Run.POST(
  { form: v.object({ message: v.pipe(v.string(), v.trim(), v.minLength(1)) }) },
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

- `Run.GET`/`Run.POST`/… wrap the handler (and skip it for other methods); `Run.ALL` runs for every method. Legacy plain exports (`export function GET(ctx, next) {}`) still work but new code uses `Run.*`. Without a `HEAD` export, `HEAD` runs the `GET` handler and `next()` answers with headers only.
- Validate inputs by declaring validators in an options object: `params` and `search` on any verb, the body via `json` or `form`. Prefer a Standard Schema library (e.g. valibot; sync only); a plain function also works. Options-only middleware (`export default Run.ALL({ search: schema })`) validates a subtree; options merge root→leaf, last validator wins.
- Schema-validated values are `[value, issues]` pairs: `const [search, searchIssues] = ctx.search`, `const [params, paramIssues] = ctx.params`, `const [body, issues] = await ctx.body`. When validation fails `issues` is set (and `value` is the raw input); handle it before use (reject, or re-render the page as in the POST above). Validators run lazily on first access. Without one, `ctx.params`/`ctx.search` are plain objects; read them rather than `ctx.url.searchParams` or `ctx.request.formData()`.
- A plain function is a validator: it returns the value `ctx.body` resolves to (typed by its return) and rejects by throwing a `Response`. The validator is the one place to validate and type the body. Without one anywhere in the chain (`{ maxBytes }` alone just sets limits), `ctx.body` is `undefined`. Malformed → 400, oversized → 413, unhandled content type → 415; defaults: `json.maxBytes` and `form.maxFileBytes` 1 MiB, `form.maxBytes` = `maxFiles` (20) × `maxFileBytes`.

  ```ts
  export const POST = Run.POST(
    {
      json(value: any) {
        if (typeof value?.title !== "string")
          throw Response.json({ error: "title required" }, { status: 400 });
        return { title: value.title.trim() };
      },
    },
    async (ctx) =>
      Response.json(createNote((await ctx.body).title), { status: 201 }),
  );
  ```

- Raw parsed value: identity validator, `json: (value) => value`; same for `form`/`params`/`search`.
- Return a `Response` → sent as-is (page does not render).
- Return nothing → the framework calls `next()` (page renders).
- When calling `next()`, return its result.
- Load page data here, and pass promises unawaited: `next({ entries: loadEntries() })` streams the page shell immediately and the page renders `<await|entries|=$global.data.entries>` when it resolves. Awaiting in the handler delays the first byte; fetching inside components creates waterfalls.
- JSON APIs: `return Response.json(obj)` (add status/headers with `Response.json(obj, { status: 201 })`); it sets `content-type: application/json`.

## Middleware

Auth, logging and the like, written once for a subtree. In `src/routes/admin/+middleware.js`:

```js
export default Run.ALL((ctx, next) => {
  if (ctx.search.key !== "letmein") {
    return new Response("unauthorized", { status: 401 });
  }
  return next();
});
```

## Layout

In `src/routes/+layout.marko`:

```marko
<header><nav><a href="/">Home</a> <a href="/about">About</a></nav></header>
<main><${input.content}/></main>
```

Layouts nest: `src/routes/+layout.marko` and `src/routes/admin/+layout.marko` both wrap `/admin/...` pages (outermost first). Middleware nests the same way, root→leaf.

Typed links: `<a href=Run.href("/products/$id", { params: { id } })>` (checked against the app's routes); also takes `search` and `hash`, encodes values, catch-all params accept arrays.

Plain `<form method="post">` + a POST handler + redirect = zero-JS forms that just work.

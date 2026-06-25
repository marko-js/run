# Validation

Marko Run has **first-class, built-in validation** for route params, query
strings, and request bodies. This was the biggest surprise when comparing my
initial notes to the source: validation is not just a "do-it-yourself" pattern —
it's a real feature wired into the handler API and the type system.

Validators run **before your handler body**, and the validated values show up on
the typed context (`context.params`, `context.search`, `context.body`).

## Standard Schema: bring your own library

A validator can be either:

- a **function** `(value) => result` that transforms/validates, or
- any **[Standard Schema](https://standardschema.dev)** validator.

Marko Run depends on `@standard-schema/spec`, so libraries that implement Standard
Schema — **[Zod](https://zod.dev), [Valibot](https://valibot.dev), and
[ArkType](https://arktype.io)** — work directly with no adapter. The examples
below use Valibot (which the project's own test fixtures use).

## Validating the request body (`json` / `form`)

Pass a `json` or `form` validator in the handler's **options** (the first argument
to `Run.POST` / `Run.PUT` / `Run.PATCH`). The validated body is available as
`await context.body`, which resolves to a `[value, issues]` tuple:

```ts
// src/routes/api/users/+handler.ts
import * as v from "valibot";

export const POST = Run.POST(
  {
    json: v.object({
      name: v.string(),
      age: v.number(),
    }),
  },
  async (ctx) => {
    const [body, issues] = await ctx.body;
    if (issues) {
      return Response.json({ issues }, { status: 400 });
    }
    // `body` is fully typed: { name: string; age: number }
    const user = await db.createUser(body);
    return Response.json(user, { status: 201 });
  },
);
```

### Form and multipart bodies

Use `form` for `application/x-www-form-urlencoded` and `multipart/form-data`. For
multipart you can validate uploaded files and set limits:

```ts
import * as v from "valibot";

export const POST = Run.POST(
  {
    form: {
      validator: v.object({
        name: v.string(),
        age: v.pipe(v.string(), v.toNumber()),
        file: v.pipe(v.file(), v.mimeType(["text/plain"])),
      }),
      maxBytes: 1_000_000,
      maxFiles: 1,
      maxFileBytes: 500_000,
      // onFile(ctx, file) { … stream/inspect each file as it arrives … }
    },
  },
  async (ctx) => {
    const [body, issues] = await ctx.body;
    if (issues) return Response.json({ issues }, { status: 400 });
    // body.file is a File-like object with a `fieldName`
  },
);
```

The `json` option also accepts an options form: `{ validator, maxBytes }`.

> **Why this matters:** request bodies are an attack surface. Built-in `maxBytes`,
> `maxFiles`, `maxParts`, and `maxFileBytes` limits let you cap resource use before
> a malicious or buggy client can exhaust memory.

## Validating params and search

`params` and `search` validators go in the same options object. They accept a
function (great for coercion) or a Standard Schema. The transformed values replace
`context.params` / `context.search`:

```ts
// src/routes/foo/$id/+handler.ts
export const GET = Run.GET(
  {
    params(value) {
      return { id: Number(value.id) }; // ctx.params.id is now a number
    },
  },
  (ctx) => {
    // ctx.params.id: number
  },
);
```

Because middleware can also declare validators (via `Run.ALL`), you can validate
or coerce search params once for a whole subtree:

```ts
// src/routes/+middleware.ts
export default Run.ALL({
  search(value) {
    if ("q" in value) return { ...value, q: Number(value.q) };
    return value;
  },
});
```

## Returning or throwing error responses

Once you detect invalid input, send an error response. Marko Run handlers may
**return a `Response`** or **throw a `Response`** — both are supported (confirmed
in the README and runtime). Throwing is handy for a shared helper:

```ts
// src/validate.ts
import type { StandardSchemaV1 } from "@standard-schema/spec";

export async function parseJson<T>(req: Request, schema: StandardSchemaV1<T>) {
  const result = await schema["~standard"].validate(await req.json());
  if (result.issues) {
    throw Response.json({ issues: result.issues }, { status: 400 });
  }
  return result.value;
}
```

> **Corrected after source review:** my first draft hedged on whether a thrown
> `Response` is honored. It is — the handler/middleware contract explicitly allows
> returning *or throwing* a WHATWG `Response`.

## Choosing where to validate

- **Handler options (`Run.GET`/`Run.POST` …)** — the idiomatic place; validated
  values are typed on the context.
- **Middleware (`Run.ALL`)** — validate/coerce once for a whole route subtree.
- **Manual checks** — for trivial cases you can still inspect `ctx.params` /
  `ctx.url.searchParams` by hand and return a `400`.

## Tips

- **Validate at the edge, load in the middle.** Reject bad input before touching
  the database. See [Data Loading](./data-loading.md).
- **Use accurate status codes** — `400` for malformed input, `404` for missing
  resources, `422` for well-formed-but-invalid.
- **Colocate schemas** next to the route (as ordinary, non-`+` files) so they're
  easy to find and reuse.

## Next steps

- [Data Loading](./data-loading.md) — once input is valid, load and render data.
- [File-based Routing](./file-based-routing.md) — where handlers and middleware
  live.

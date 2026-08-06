---
"@marko/run": patch
---

Type `Route["body"]` as `undefined` for verbs that cannot carry one. Without a typed validator, `body` widened to `undefined | Promise<unknown>` for every verb, so a GET page's `$global.body` and `GetContext(...).body` invited `await` handling the runtime never satisfies — it only creates a body thenable for POST/PUT/PATCH with a `json`/`form` option configured — while the very same file's `Run.GET` handler correctly typed `ctx.body` as `undefined`. The hedge now only survives when the def's method can carry a body; the fully generic `Route`/`Context` (a `ctx.parent`, say) keeps it, since a generic context may belong to a bodied route.

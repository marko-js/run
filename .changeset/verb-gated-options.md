---
"@marko/run": patch
---

Validation options from a verb-specific middleware (e.g. `Run.POST({ search, form })`) no longer apply to verbs the middleware doesn't run on; GET-stamped options still serve HEAD.

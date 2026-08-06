---
"@marko/run": patch
---

Make a wrong verb export fail loudly instead of silently answering 204. Route verbs are discovered from export names alone, so two ordinary mistakes produced routes that looked wired up and answered `204 No Content` with zero diagnostics: a truthy non-function export (`export const GET = 42`, or an accidental object after a refactor) degraded to a no-op handler, and the classic copy-paste rename `export const GET = Run.POST(...)` registered a GET route whose handler the runtime then refused to run for GET requests. `normalizeHandler` now knows which export it is normalizing and throws a clear error for both — at module load in dev (a 500 naming the export and the factory) and at server startup in production, while a promise-wrapped handler rejects with the same error on its first call instead. `Run.ALL` handlers remain valid under any verb export, and a nullish export keeps its previous no-op behavior.

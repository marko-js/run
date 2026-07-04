---
"@marko/run": minor
---

Add experimental persisted pages (single-page server-first updates): a
`persisted` plugin option that compiles persisted-capable output (forwarded
to `@marko/vite`), negotiates update renders in the generated router
(`accept: text/marko-patch` with route verification), registers a client
router from every generated route wrapper with that route's `?update`
entry, and applies server-rendered update payloads to the live page on
same-route navigations — no reload, client state intact, full-navigation
fallback on any protocol failure. Updates are additionally gated on build
identity (`@marko/vite`'s client-build digest, serialized to the page and
required back on update fetches), so deployments invalidate in-flight pages
into full navigations instead of applying stale patches. Requires a Marko
runtime with persisted support.

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
fallback on any protocol failure. Requires a Marko runtime with persisted
support.

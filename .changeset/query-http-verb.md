---
"@marko/run": minor
"@marko/run-explorer": patch
---

Support the QUERY HTTP method (RFC 10008): handlers can export `QUERY`, and it participates in routing, typed options/body validation, and the route explorer. Like POST, a QUERY handler's `next` renders the page when the route has one.

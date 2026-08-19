---
"@marko/run": patch
---

`context.body` is now only defined when the route's merged options include a `json`/`form` validator — a limits-only option (e.g. `maxBytes` in middleware) no longer exposes an unvalidated body — and the cheatsheet documents the plain-function validator pattern.

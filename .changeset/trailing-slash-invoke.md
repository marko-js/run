---
"@marko/run": patch
---

The configured `trailingSlashes` policy now applies through the public `match`/`invoke` pair (e.g. the node adapter's `matchMiddleware` + `invokeMiddleware`), not just the generated `fetch`, so the same app no longer serves duplicate-content URLs depending on how it is mounted.

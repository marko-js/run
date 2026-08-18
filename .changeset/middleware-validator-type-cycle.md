---
"@marko/run": patch
---

Fix route middleware and handler types collapsing to `any` when a middleware derives `next()` data from its context while a downstream handler declares validators.

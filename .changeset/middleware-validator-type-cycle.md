---
"@marko/run": patch
---

Fix route handler and middleware types collapsing to `any` when a middleware derives `next()` data from its context while a downstream handler declares validators.

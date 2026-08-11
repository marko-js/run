---
"@marko/run": patch
---

`throw null` in a handler no longer crashes the dev server; it now skips handling the request in dev the same way it does in production.

---
"@marko/run": patch
---

`Run.href` now omits nullish `search` values instead of serializing them as `?key=undefined`/`?key=null`.

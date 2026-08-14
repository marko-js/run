---
"@marko/run": patch
---

`Run.href` now omits undefined `search` values instead of serializing them as `?key=undefined`.

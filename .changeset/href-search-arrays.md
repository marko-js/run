---
"@marko/run": patch
---

`Run.href` now repeats the key for an array search value (`tag: ["a", "b"]` becomes `tag=a&tag=b`), matching how `ctx.search` parses it.

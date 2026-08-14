---
"@marko/run": patch
---

`context.render` now merges a caller-supplied init with the HTML defaults, so passing a status or extra headers no longer drops the `content-type`.

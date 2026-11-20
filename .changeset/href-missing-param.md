---
"@marko/run": patch
---

`Run.href` now throws when a param, or a catch-all item, is `undefined` or `null`, instead of writing it into the URL as text.

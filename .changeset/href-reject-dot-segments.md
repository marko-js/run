---
"@marko/run": patch
---

`Run.href` now throws when a param, or a catch-all item, is empty, `.` or `..`, instead of building a URL that points to a different path.

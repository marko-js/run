---
"@marko/run": patch
---

Send `Vary: Accept` with 404 and 500 responses that pick between the HTML error page and an empty body by `Accept`, so caches keep the two apart. The Node adapter now adds a response's `Vary` to one set by earlier middleware instead of replacing it.

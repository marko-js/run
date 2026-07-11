---
"@marko/run": patch
---

Warn in dev and build about route files that look routable but silently are not: `+`-prefixed files that match no routable type (e.g. `+server.js`) and `[param]`-bracket file or directory names now explain the `+handler.*` / `$param` conventions. The "no http verb exports" warning also names any lowercase verb-like exports it found (e.g. `get`) and shows the `Run.GET(handler)` form.

---
"@marko/run": patch
---

Warn in dev and build about route files that look routable but silently are not: a `+type` marker matching no routable type (e.g. `+server.js`, a wrong extension like `+page.txt`, a typo'd `+pge.marko`) points at the routable file list, and a `$param` name missing its `+type` suggests the fix. `[flag]` variant groups (e.g. `@ebay/arc`'s `header[mobile+android].js`, or `+page[mobile].marko`) are ignored so they never read as broken routes. The "no http verb exports" warning also names any lowercase verb-like exports it found (e.g. `get`) and shows the `Run.GET(handler)` form.

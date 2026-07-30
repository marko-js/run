---
"@marko/run": patch
---

A persisted app now compiles one shell template per layout chain with the page dispatched into it, so the layout is the same template instance either side of a navigation instead of a fresh per-route entry.

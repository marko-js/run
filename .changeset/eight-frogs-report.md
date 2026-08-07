---
"@marko/run-adapter-netlify": patch
---

Serve dotted paths through the edge function instead of dropping them. The default edge entry previously matched only dot-free paths (`pattern: "^[^.]*$"`), so any route whose URL contained a dot — a catch-all serving `report.2024.pdf`, a `$handle` segment holding `jane.doe`, a handler emitting `.xml` — never reached the router and 404'd. The entry now runs on every path, serving a matching static file first for `GET`/`HEAD` requests (like the functions adapter's `preferStatic`) and falling back to the app's router, which also lets the app's `+404` page apply to unmatched paths.

---
"@marko/run-adapter-netlify": patch
---

Serve dotted paths through the edge function instead of dropping them. The default edge entry declared `pattern: "^[^.]*$"`, so any route whose URL contained a dot — a catch-all serving `report.2024.pdf`, a `$handle` segment holding `jane.doe`, a handler emitting `.xml` — never reached the router and 404'd. The entry now runs on every path and falls back to Netlify when the app answers with a 404, so those routes serve while published files and the app's own `+404` page keep working.

---
"@marko/run-adapter-netlify": patch
---

Serve dotted paths through the edge function instead of dropping them. The default edge entry declared `pattern: "^[^.]*$"`, so any route whose URL contained a dot — a catch-all serving `report.2024.pdf`, a `$handle` segment holding `jane.doe`, a handler emitting `.xml` — never reached the router and 404'd. The entry now declares the app's own routes as its Netlify path declarations, so those routes run and every other path stays with the platform's static handling; the build's assets directory is excluded so a catch-all route cannot claim it.

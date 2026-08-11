---
"@marko/run-adapter-netlify": patch
---

Serve dotted URLs (e.g. `report.2024.pdf`, `jane.doe`, `.xml`/`.json` routes) on the edge adapter; previously any path containing a dot skipped the router and 404ed.

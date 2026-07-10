---
"@marko/run": patch
---

Remove the runtime's `node:url` import in favor of the global `URLSearchParams` (available everywhere the runtime runs), so the router no longer requires Node compatibility on edge targets like Cloudflare Workers.

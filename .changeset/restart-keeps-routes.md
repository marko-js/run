---
"@marko/run": patch
---

Keep the dev server's routes, request log and streamed-error overlay working after Vite restarts it, as it does when `vite.config.ts` changes. Every route answered 404 after such a restart.

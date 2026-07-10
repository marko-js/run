---
"@marko/run": patch
---

Detect script route handler and middleware exports in dev by parsing the file in isolation instead of transforming it through the client environment, which pulled each file's server-only import graph through the browser pipeline and errored on imports only the server environment can resolve (e.g. `cloudflare:workers`). `.marko` handlers still compile through the pipeline before export detection.

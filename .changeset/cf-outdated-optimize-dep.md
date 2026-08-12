---
"@marko/run": patch
---

Dev no longer serves endless `504 Outdated Optimize Dep` for client dependencies when a multi-environment plugin (e.g. `@cloudflare/vite-plugin`) shares the dev server, on Vite 8.1.4+.

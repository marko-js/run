---
"@marko/run": patch
---

Stop leaking a dev worker on each custom server entry restart, skip restarts for route files the entry does not import, and keep the dev server working after a Vite config edit: a custom entry restarts instead of silently ignoring later edits, and the default entry no longer answers every request with a 404.

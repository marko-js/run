---
"@marko/run": patch
---

Stop leaking a dev worker on each custom server entry restart, skip restarts for route files the entry does not import, and restart on Vite config changes instead of silently ignoring later entry edits.

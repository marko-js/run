---
"@marko/run": patch
---

Isolate the dev server's generated route templates from the build `outDir`. A concurrent `marko-run build` empties `outDir` and deletes `<outDir>/.marko-run`, which — because the dev server generated and imported its templates from that same directory — pulled the files out from under a running dev server and left every route responding `500` ("Failed to load … `.marko-run/<route>.server-entry.marko`") until a restart. In dev these files now live under `node_modules/.cache/@marko/run` (outside `outDir`, and ignored by the dev watcher), so `build` and `dev` can no longer collide.

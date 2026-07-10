---
"@marko/run": patch
---

Fix a build race where a virtual file (eg. the router behind `@marko/run/router`) could be served as an empty module if the bundler requested it while route rendering was still in flight, producing `IMPORT_IS_UNDEFINED`/`MISSING_EXPORT` diagnostics and a server bundle with an empty router.

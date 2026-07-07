---
"@marko/run": patch
"@marko/run-adapter-netlify": patch
---

Avoid Node's `DEP0190` deprecation warning by joining the command and args into a single string instead of passing an args array alongside `shell: true` when spawning the dev/preview server.

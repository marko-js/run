---
"@marko/run": patch
"@marko/run-adapter-netlify": minor
"@marko/run-adapter-static": patch
---

Have `marko-run dev` run the same entry and `platform` the deployed adapter uses, and keep the static crawler on its own origin for links whose path starts with `//`.

---
"@marko/run-adapter-vercel": minor
"@marko/run": patch
"@marko/run-adapter-netlify": minor
"@marko/run-adapter-static": patch
---

Add a Vercel adapter for deploying @marko/run apps to Vercel Functions via the Build Output API, have `marko-run dev` run the same entry and `platform` the deployed adapter uses, and keep the static crawler on its own origin for links whose path starts with `//`.

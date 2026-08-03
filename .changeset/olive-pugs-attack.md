---
"@marko/run": patch
---

Apply the build's `resolve.conditions`/`mainFields` per environment. Vite drops both keys for every non-client environment, so setting them at the top level left the SSR build on Vite's defaults and never applied the `node` condition it was meant to get.

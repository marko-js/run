---
"@marko/run": patch
---

Apply the build's `resolve.conditions` per environment. Vite drops the key for every non-client environment, so setting it at the top level left the SSR build on Vite's defaults and never applied the `node` condition it was meant to get. The accompanying `resolve.mainFields` override is dropped, having reproduced Vite's own per-environment defaults exactly.

---
"@marko/run": patch
---

Ship an LLM-optimized syntax reference (`llms.md`) inside the package and point the non-routable-lookalike warnings at it. In controlled testing with weak coding agents, an imperative pointer ("READ node_modules/@marko/run/llms.md before changing route files") is what converts the shipped reference from unused (agents almost never explore node_modules on their own) into read-and-applied.

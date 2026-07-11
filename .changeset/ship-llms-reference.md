---
"@marko/run": patch
---

Ship an LLM-optimized routing reference (`cheatsheet.md`) inside the package and expose it through the `exports` map as `@marko/run/cheatsheet.md`. When a coding agent is driving the terminal, `@marko/run`'s compile-time errors (duplicate routes, invalid route paths, codegen failures) now end with a pointer to the cheat sheet (`Fix guide: READ …/cheatsheet.md before writing a fix.`) so the agent reads the routing conventions before attempting a fix. This mirrors the compiler's own fix-guide (marko-js/marko#3423) for errors thrown by `@marko/run` itself.

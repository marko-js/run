---
"@marko/run": patch
---

Re-export the Standard Schema types so inferred handler types stay nameable without a direct dependency on `@standard-schema/spec`, which failed to type-check for consumers with isolated node_modules.
Treat an adapter's server entry as a dev entry so it evaluates the generated router, fixing dev for adapters whose entry runs in its own global scope.

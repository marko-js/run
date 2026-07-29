---
"@marko/run": patch
---

Persisted navigation now covers GET forms and popstate, remembers routes that cannot be patched, and times out rather than parking. `installPatchNavigation` is exported so the behaviour can be driven against a test realm.

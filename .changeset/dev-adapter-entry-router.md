---
"@marko/run": patch
---

In dev the adapter's entry imports the generated router directly, and a client module calling `Run.href` loads the client runtime before it evaluates.

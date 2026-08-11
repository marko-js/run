---
"@marko/run": patch
---

Ctrl+C on `marko-run preview` now shuts down the spawned server; previously it survived the CLI and kept its port.

---
"@marko/run": patch
---

The servers spawned by `marko-run preview` and `marko-run dev` now shut down when the CLI receives SIGINT or SIGTERM; previously they survived the CLI and kept their port.

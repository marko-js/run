---
"@marko/run": patch
---

Fix `Run.href` with an options literal inside a handler's return making the handler's type circular (`TS7022`).

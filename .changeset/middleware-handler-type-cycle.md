---
"@marko/run": patch
---

Fix `Run.DELETE({ params(...) }, handler)` and similar losing its typing (TS7022/TS2554) when a parent-segment middleware passes context-derived data to `next`.

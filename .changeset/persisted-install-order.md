---
"@marko/run": patch
---

Fix persisted navigation never installing: the applier is published by the page entry after the chunk holding the navigation code runs, so it is now read per navigation rather than at install.

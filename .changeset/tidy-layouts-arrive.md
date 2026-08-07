---
"@marko/run": patch
---

Fix the dev server not applying an added or removed `+layout.marko` until an unrelated edit or restart. The generated route entry templates are now explicitly invalidated when their content changes, so layout composition updates take effect immediately.

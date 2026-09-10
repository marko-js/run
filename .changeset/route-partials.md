---
"@marko/run": patch
---

Add `@<name>.marko` partial templates: pages and layouts receive them as `input.<name>` attribute tags, and a deeper partial overrides the one above while receiving it as its own `input.<name>`.

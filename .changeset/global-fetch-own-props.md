---
"@marko/run": patch
---

Fix `$global.fetch` (and other context methods) being undefined in templates rendered with Marko's tags API. The tags API runtime shallow copies `$global` when rendering, so context members must be own enumerable properties rather than class prototype members.

---
"@marko/run": patch
---

Revert context to a plain object so its methods and lazy getters survive being spread into `$global`

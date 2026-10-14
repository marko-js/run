---
"@marko/run": patch
---

The production `Run.href` rewrite no longer breaks in a client module that binds `href` (a parameter, a loop variable, a module-level name): its helpers are imported under names the module does not use.

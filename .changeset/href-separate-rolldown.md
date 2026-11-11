---
"@marko/run": patch
---

Fix `Run.href` calls left unrewritten in client builds, which threw `Run is not defined`, when the app's rolldown for Vite differs from `@marko/run`'s; `@marko/run` no longer installs its own rolldown.

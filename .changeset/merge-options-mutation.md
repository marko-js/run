---
"@marko/run": patch
---

Options declared in `+middleware` no longer leak between routes, and a handler declaring only a size limit keeps the middleware's validator. A key explicitly set to `undefined` now overrides the inherited option; an absent key leaves it in place.

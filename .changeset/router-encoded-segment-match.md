---
"@marko/run": patch
---

Routes with non-ASCII or otherwise URL-encoded static segments now match their percent-encoded request paths instead of silently 404ing.

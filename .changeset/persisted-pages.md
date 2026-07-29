---
"@marko/run": minor
---

Add experimental persisted-page routing behind the `persisted` plugin option:
generated progressive enhancement streams Marko patches for links, forms, and
history navigation, with a full-document fallback for any mismatch. Patches
are bound to the route and build identity and served `cache-control: no-store`.

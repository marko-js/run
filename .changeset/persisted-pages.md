---
"@marko/run": minor
---

Add experimental persisted-page routing behind the `persisted` plugin option.
Generated progressive enhancement negotiates streamed Marko updates for
same-origin links, forms, redirects, and history navigation, while retaining a
full-document fallback for mismatched or failed updates.

Update responses are bound to the generated route and build identity and are
served with `cache-control: no-store`.

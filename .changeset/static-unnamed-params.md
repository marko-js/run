---
"@marko/run-adapter-static": patch
---

Stop writing pages for the literal paths of unnamed `$` and `$$` routes, such as `products/$.html`; those routes are still built for the paths that link to them.

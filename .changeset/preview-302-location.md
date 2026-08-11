---
"@marko/run-adapter-static": patch
---

Preview server redirects to the 404 page again; the `Location` header was being dropped by the compression middleware, leaving browsers on a blank page.

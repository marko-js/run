---
"@marko/run": patch
---

Apply the configured `trailingSlashes` policy through the public `match`/`invoke` pair, not just the generated `fetch`, so the same app no longer serves duplicate-content URLs depending on how it is mounted. Also simplifies the trailing-slash checks in generated routers.

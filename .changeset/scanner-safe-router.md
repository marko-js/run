---
"@marko/run": patch
---

Exclude the virtual `@marko/run/router` module from dependency optimization in every environment, so an environment that scans a server entry (e.g. a Cloudflare Workers environment) no longer fails its dependency scan trying to load the virtual file from disk.

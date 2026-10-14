---
"@marko/run": patch
---

The Node middleware keeps the server's origin for a request whose path starts with `//` (or is an absolute URL), so such a path can no longer redirect to another host.

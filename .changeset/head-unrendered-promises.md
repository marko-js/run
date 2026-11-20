---
"@marko/run": patch
---

Keep a HEAD request from crashing the server when a promise passed to the page rejects, since HEAD skips the render that would handle it.

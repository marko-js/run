---
"@marko/run": patch
---

Errors thrown during a page's synchronous render now apply the `+500` page instead of escaping to the host framework's error handler; errors after streaming has begun are unchanged and can be handled with `<try>`/`<@catch>`.

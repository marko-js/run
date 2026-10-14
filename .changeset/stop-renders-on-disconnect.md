---
"@marko/run": patch
---

A Marko 6 page now stops rendering when its client disconnects: the context exposes the request's `signal`, which Marko reads as `$global.signal`.

The node middleware no longer passes a failed response's status and headers on to the error response `next` writes, such as a page's `cache-control` when its render throws before the first chunk.

In dev, client `Run.href` calls are rewritten as in production builds, so they no longer need the global `Run` defined first: a template a handler renders, or a tag calling it at module level, now works. Dev entries no longer define the global, matching production.

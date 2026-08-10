---
"@marko/run": patch
---

Fix HEAD requests on routes with a `Run.GET` handler.

Two bugs combined to break auto-generated HEAD handling: `call` compared a handler's `"GET"` verb stamp against `context.method` (`"HEAD"`) and skipped the handler entirely, leaving `context.data` empty and causing the page template to run with missing data; and `context.render` built and streamed the full template even for HEAD, where the body is discarded anyway.

`call` now treats a `GET`-stamped handler as matching a HEAD request — an explicit `HEAD` export gets its own entry so there is no double-run risk. `context.render` returns a no-body response immediately for HEAD, so the page template never executes and any data the GET handler placed in `context.data` is used only for response headers.

`createMiddleware` no longer sets `Content-Length: 0` on HEAD responses or 204/304 statuses. RFC 9110 §8.6 forbids the header on 204, and on HEAD it falsely advertises an empty resource to CDNs and uptime monitors.

---
"@marko/run": patch
---

Abort `request.signal` and cancel the response stream when a client disconnects. The node request path built its `Request` without a signal, so `request.signal.addEventListener("abort", ...)` — the standard way to notice a client is gone — could never fire, and the only cancellation was a `res.destroyed` check reached between chunks. A stream that had gone idle never reached it, so its timers and upstream work kept running after the client left. Affects the dev server, `marko-run preview` and `@marko/run-adapter-node` alike, since all three share this middleware. Along the way `getRender` — the helper `@marko/run/adapter/middleware` exported for picking the stashed Marko render over the body — is folded into the new `getBodyReader`, which makes the same choice and hands back the `read`/`cancel` pair the middleware itself writes with.

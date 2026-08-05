---
"@marko/run-adapter-static": patch
---

Serve the prerendered `+404` page from `marko-run preview` with a real 404 status. sirv's `send` ends with an unconditional `writeHead(200, …)` that overwrote the status assigned from its `setHeaders` hook, so `GET /404` answered 200 with the 404 body and no request ever produced a 404 status.

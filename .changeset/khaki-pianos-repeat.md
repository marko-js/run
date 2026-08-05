---
"@marko/run-adapter-static": patch
---

Fail the build when a route answers with a client or server error while crawling. Such a path writes no file, so the build previously finished green with the page missing from `dist/public` and only a `console.warn` to show for it. `crawl` now collects every failed path and throws once crawling settles, listing each status and path. A success status with nothing to prerender — the 204 a handler-only route falls back to, say — still only warns.

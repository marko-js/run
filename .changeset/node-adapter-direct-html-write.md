---
"@marko/run": patch
---

Speed up HTML responses on the Node adapter by writing a page render's HTML strings straight to the socket instead of routing them through a whatwg `ReadableStream`/`Response` body. The public API is unchanged and other adapters still read `response.body` as before.

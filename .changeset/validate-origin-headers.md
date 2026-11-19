---
"@marko/run": patch
---

Answer requests whose `Host`, `X-Forwarded-Host` or `X-Forwarded-Proto` is missing or not a valid `http(s)` scheme and `host[:port]` with a 400, instead of joining the header text onto the request URL. `getOrigin` now returns `null` for such requests.

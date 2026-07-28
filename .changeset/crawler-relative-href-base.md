---
"@marko/run-adapter-static": patch
---

Resolve crawled links against the page they were found on rather than the origin. A relative href previously lost its directory, so `./sibling` on `/docs/reference/language` was crawled as `/sibling`, which 404s and wrote the 404 page out under that name.

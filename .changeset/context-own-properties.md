---
"@marko/run": patch
---

Expose context members (`params`, `search`, `fetch`, `render`, `redirect`,
`back`) as own enumerable properties again. The context is the render's
`$global`, which Marko copies with an own-property spread, so the class
refactor's prototype getters/methods were invisible to template
`$global.params`/`$global.search`/`$global.fetch(...)` reads.

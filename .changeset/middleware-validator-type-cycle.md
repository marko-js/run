---
"@marko/run": minor
---

Add a file-wide `export const options = Run.options({...})` for route validators, merged across the whole route and visible in every file's context — including through the middleware/handler shapes whose inline options previously collapsed the route's types to `any`.

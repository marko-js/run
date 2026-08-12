---
"@marko/run": patch
---

Options declared inside an array `+handler`/`+middleware` export (e.g. `export const POST = [Run.POST({ json: schema }, fn), other]`) now apply; previously the validator never ran and `context.body` stayed undefined. Reusing a handler in single-element arrays no longer mutates it.

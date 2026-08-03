---
"@marko/run": patch
---

Stop forcing both `import` and `require` into `resolve.conditions`. Vite already appends whichever one matches the importer, so listing both made a dependency that declares `require` before `import` in its `exports` map resolve to its CommonJS build.

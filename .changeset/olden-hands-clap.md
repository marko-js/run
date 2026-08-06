---
"@marko/run": patch
---

Accept a bare truthy `json`/`form` handler option — `Run.POST({ form: true }, handler)` — as "parse the body with the defaults". The option was probed with `"~standard" in option` to tell a Standard Schema from an options object, and `in` throws on a primitive, so an untyped project writing the natural `form: true` got an opaque 500 out of the runtime's option merging instead of a parsed body. The types already forbid the primitive, so type-checked projects are unaffected.

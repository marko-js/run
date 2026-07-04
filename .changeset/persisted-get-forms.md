---
"@marko/run": patch
---

The persisted client router intercepts same-origin GET form submissions
and applies them as updates — a GET form is a link with parameters
(search boxes, filter chips). The submitter's name/value and
`formaction`/`formmethod`/`formtarget` overrides are honored, files are
dropped from the query exactly as native submission does, and forms an
earlier listener already handled (`preventDefault`) are untouched. POST
submissions stay native until the PRG slice (a mutation's fallback must
never replay the request).

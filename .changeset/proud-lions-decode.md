---
"@marko/run": patch
---

URL-decode catch-all (`$$`) route params. Dynamic (`$`) segments were decoded but the catch-all was handed through raw, so the two param kinds disagreed and `Run.href`'s percent-encoding had no matching decode — `Run.href` for `["docs", "café"]` produced `/docs/caf%C3%A9`, and the linked page read back `params.rest === "docs/caf%C3%A9"`. The catch-all now decodes like every other param, completing the href round-trip. A request whose catch-all carries a malformed percent sequence now fails the same way it always has for dynamic segments.

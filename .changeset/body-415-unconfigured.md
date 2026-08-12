---
"@marko/run": patch
---

Requests whose `Content-Type` matches no configured body option now respond 415 instead of being parsed by the form fallback and skipping validation.

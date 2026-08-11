---
"@marko/run": patch
---

Malformed request bodies (invalid JSON, bad encoding, unparsable multipart) now respond 400 and bodies exceeding the configured size limits respond 413, instead of surfacing as server 500s.

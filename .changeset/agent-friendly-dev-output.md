---
"@marko/run": patch
---

Improve `marko-run dev`/`preview` output when stdout is not an interactive terminal (CI, piped output, AI agents): the animated request-log spinner is disabled so logs are plain sequential lines instead of repeated cursor-control escape sequences. Also log a plain-text notice when the requested port is in use and the server falls back to a different port.

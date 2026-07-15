---
"@marko/run-adapter-static": patch
---

Fix a race where the build could complete before crawled pages were fully written to disk, intermittently causing missing or truncated files in the static output.

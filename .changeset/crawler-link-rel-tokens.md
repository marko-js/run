---
"@marko/run-adapter-static": patch
---

Match `<link rel>` against each of its tokens when deciding what to crawl. `rel` is a space-separated token list, but it was compared as a whole string, so a page linked as `rel="alternate stylesheet"` fell through the allowlist and was left out of the static build.

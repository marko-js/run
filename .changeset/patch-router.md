---
"@marko/run": minor
"@marko/run-adapter-static": patch
---

Add the experimental `patches` option: links and forms to the app's routes update the live page from the server's response instead of loading a new document. The static adapter rejects it, since its pages are files.

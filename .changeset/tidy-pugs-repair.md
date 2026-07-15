---
"@marko/run": patch
"@marko/run-adapter-netlify": patch
---

Remove Playwright from the test suite in favor of an in-process jsdom test browser, and make dev/preview server shutdown reliable — faster, less flaky tests.

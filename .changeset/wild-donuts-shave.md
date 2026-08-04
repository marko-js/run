---
"@marko/run-adapter-static": patch
---

Log a summary once the static build finishes crawling: how many paths rendered, redirected and failed, plus every path that answered `404`. A `404` still does not fail the build, but it is nearly always a link pointing at a page that is gone, so those paths are now listed instead of passing unnoticed.

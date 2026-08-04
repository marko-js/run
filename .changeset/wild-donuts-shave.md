---
"@marko/run-adapter-static": patch
---

Log a summary once the static build finishes crawling: how many paths succeeded, failed, redirected and answered `404`, followed by each path that answered `404` or a status the crawler has no handling for, with its status. Those paths still do not fail the build, but they were previously invisible (a `404`) or a lone warning per path (everything else), so they are now listed together under the counts.

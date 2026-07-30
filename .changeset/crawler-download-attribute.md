---
"@marko/run-adapter-static": patch
---

Stop crawling `<a download>` links, and honor `rel="nofollow"` (plus `enclosure` and `external`) when it appears alongside other `rel` tokens. A bare `download` attribute parses as an empty string, so the check meant to skip those links only ever matched `download="filename"`, and `rel` was compared as a whole string rather than a token list. Links to files the app server does not serve were followed, and each one wrote the 404 page out under that path.

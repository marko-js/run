---
"@marko/run": patch
---

The generated router's trailing-slash check now uses `pathname.length > 1 && pathname.endsWith('/')` instead of an index-and-`charAt` comparison, shrinking each emitted occurrence and dropping the `last` temporary. Matching behavior is unchanged, including leaving a bare `/` untouched.

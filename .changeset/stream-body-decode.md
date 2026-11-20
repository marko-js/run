---
"@marko/run": patch
---

Read JSON and urlencoded request bodies without allocating their full size limit up front, so memory use follows the size of the body that was sent.

---
"@marko/run": patch
---

Persisted update fetches send `x-marko-from` (the client's current route
pattern); the generated router stamps cross-route renders with
`$global.persistedSeed`, so navigations into pages that derive content
from client-state computes over server-only data apply as true updates —
the fresh subtree's state seeds from the payload instead of falling back
to a full navigation.

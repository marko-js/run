---
"@marko/run": patch
---

Report a clear error in dev when a handler returns something other than a `Response`. Returning data directly (the `return { items }` habit) previously reached the node adapter, which failed with `headers is not iterable` from its own internals and named neither the route nor the contract. The dev-mode guard now names the verb, the route, and what to return instead.

Also register the `NotHandled`/`NotMatched` sentinels with `Symbol.for`. A build can load more than one copy of the runtime module, and a sentinel returned from user code was not recognized by another copy's comparison — flowing into the adapter as if it were a response.

---
"@marko/run": patch
---

Keep one deleted route file from wedging the dev server. Deleting a `+page`/`+handler` removed the route's generated template from disk while the dev watcher actively poked the deleted route's own modules with synthetic change events, so an adapter that eagerly re-evaluates invalidated modules reloaded an id the plugin answered with `undefined`, and every SSR route 500'd with "Failed to load url ... Does the file exist?" until a manual restart. The watcher no longer touches a deleted file's module chain, and a stale reload of a vanished generated template now answers an empty module instead of failing the whole request graph.

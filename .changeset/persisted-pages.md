---
"@marko/run": minor
---

Add experimental persisted pages: run-owned single-page server-first
updates. A `persisted` plugin option compiles persisted-capable output
(forwarded to `@marko/vite`) and the generated router negotiates update
renders (`accept: text/marko-patch`, verified against the route) instead of
full documents. Each generated route wrapper registers a client router
bound to that route's `?update` entry; on navigation the server-rendered
patch applies to the live page with no reload and client state intact, and
any protocol failure falls back to a full navigation.

- Responses apply as they stream: synchronous page content settles on the
  first frame (history and scroll commit there) and each async boundary's
  body lands as its frame arrives.
- Cross-route navigations between routes sharing a layout chain apply as
  updates too. A generated client route table (patterns + lazy loaders,
  tree-shaken via side-effect-only imports so template/walks strings do not
  pin into the eager chunk) lets the router match any route's links, load
  the target's template and update entry in parallel with the fetch, and
  swap at the layout's already-dynamic content hop so layout DOM and client
  state survive. Targets whose page setup needs server-only code fall back
  automatically, and `x-marko-from` seeding stamps `$global.persistedSeed`
  so pages deriving content from client-state computes over server-only
  data still apply as true updates.
- The client router intercepts same-origin GET forms as parameterized
  navigations and POST forms as PRG-shaped updates (mutation POST →
  followed GET streams a patch applied in place, same-URL refresh adding no
  history entry), honoring submitter `formaction`/`formmethod`/`formtarget`/
  `formenctype` overrides and `enctype`. Server-side negotiation is
  method-agnostic and verifies the route against the final post-redirect
  URL, so cross-route redirects fall back. Mutations are never replayed by
  the fallback ladder, and a `marko-run:navigate` event fires after every
  applied navigation. Non-2xx patch responses (e.g. a validation
  re-render) still apply in place, keeping focus and scroll.
- Updates are gated on build identity (`@marko/vite`'s client-build digest,
  serialized to the page and required back on update fetches), so a
  deployment invalidates in-flight pages into full navigations rather than
  applying stale patches.
- Context members (`params`, `search`, `fetch`, `render`, `redirect`,
  `back`) are exposed as own enumerable properties again, so template
  `$global.params`/`$global.search`/`$global.fetch(...)` reads keep working
  under the persisted render path (Marko copies the context with an
  own-property spread).

Requires a Marko runtime with persisted support.

# Performance

Runtime speed and bundle size opportunities. Format and rules: [README.md](README.md).

## Size the urlencoded/JSON body buffer to content-length instead of pre-allocating the full maxBytes ceiling

`packages/run/src/runtime/internal.ts` › `readBodyWithLimit` | 2026-07-18 | impact:med | effort:low

`readBodyWithLimit` eagerly allocates `const bytes = new Uint8Array(maxBytes)` sized to the ceiling (internal.ts:120), fills only `receivedBytes`, and returns `bytes.subarray(0, receivedBytes)` (internal.ts:141). For a urlencoded body, `readBody` destructures the form option with `maxBytes = maxFiles * maxFileBytes` (internal.ts:160; defaults `maxFiles=20`, `maxFileBytes=1MiB` at internal.ts:470-472), so a 21-byte `application/x-www-form-urlencoded` POST allocates a full 20 MiB (20,971,520-byte) transient buffer. The actual size is already known — `content-length` is read at internal.ts:109 — but it is used only for the too-large guard (internal.ts:111), never to size the allocation. The JSON path shares `readBodyWithLimit` with a 1 MiB default (internal.ts:149-153): same pattern, smaller magnitude. This means any `Run.POST({ form })` login/signup/contact route allocates a file-oriented 20 MiB buffer per fields-only request; N concurrent tiny POSTs each force a 20 MiB transient allocation (GC pressure / cheap DoS amplification), and a route that raises `maxFileBytes` for large uploads makes the very first request eagerly allocate/OOM regardless of body size. Multipart uploads are unaffected — they stream via the form-data parser (internal.ts:166). Fix: `const cap = contentLength !== null ? Math.min(Number(contentLength), maxBytes) : maxBytes; const bytes = new Uint8Array(cap);`, and fall back to a growable/chunk-collecting concat only for chunked bodies without a content-length. Docs (website/docs/marko-run/validation.md) document the `maxFiles * maxFileBytes` default but not the pre-allocation.

## Support serializing a nested slice of `data` so opting `data` in doesn't push every route's server-only data to the client

`packages/run/src/runtime/internal.ts` › `createContext` | 2026-07-18 | impact:med | effort:med

`serializedGlobals` is all-or-nothing per top-level key. `createContext` defaults it to `{ params: true, url: true }` (internal.ts:200-203), and both `render` and `call` shallow-merge every handler value into the single `context.data` object via `Object.assign(context.data, data)` (internal.ts:285-287, 303-305). Marko's `getFilteredGlobals` (marko repo `packages/runtime-tags/src/html/writer.ts:1630-1666`) then selects only whole top-level `$global` keys — `for (const key in serializedGlobals) { … value = $global[key] }` — with no nested-path support. So a shared layout tag reading `$global.data.cart` on the client forces `serializedGlobals.data = true`, which serializes the entire `data` object on every route: per-route, server-only values passed through `next({ … })` (validation `errors`/`values`, a confirmed `order` with shipping address and line items rendered as static SSR HTML only) all get emitted into the client resume/state script in addition to the visible HTML. There is no way to expose just `data.cart`. The workaround is off the documented path: route the cross-navigation slice through a dedicated top-level context prop (`ctx.cart = …` + a `Context` augmentation) and set `serializedGlobals.cart = true`. Fix directions: (a) run supports scoped serialization keys (e.g. `serializedGlobals["data.cart"]`) or a dedicated serializable-global helper, or (b) marko's `getFilteredGlobals` accepts dotted/nested selectors. `serializedGlobals` is a run `Context` field (documented in website/docs/marko-run/runtime.md) and the `data` convention is run's, so this belongs in run; the enforcing top-level-only filter lives in marko. Docs never mention that opting `data` in serializes all of it.

## Serialize the `params`/`url` globals only when a route's templates reference them

`packages/run/src/runtime/internal.ts` › `createContext` | 2026-07-18 | impact:low | effort:med

`createContext` unconditionally sets `serializedGlobals: { params: true, url: true }`, and Marko's serializer includes every allow-listed defined global with no reference check (`getFilteredGlobals` in marko's `packages/runtime-tags/src/html/writer.ts:1630`). So every page with any client JS ships `params:{}` and `url:new URL("http://host/path")` in its hydration payload plus a URL revival at boot, even for a route like `<let/n=0><button onClick() { n++ }>${n}</button>` that references neither. It is only ~60-80 bytes per response, and the blanket opt-in is understandable — a lazily-mounted first reader of a non-serialized global would see undefined — but for a framework whose headline is minimal JS, a need-based approach (enable each global only when the route's templates actually reference `$global.url`/`$global.params`) would eliminate the constant tax.

## Restore the E2 kill switch's elision parity, or gate the claim-set channel off at the narrower digest width

`packages/run/src/runtime/claim-sets.ts` › `claimSetsEnabled` | 2026-07-28 | impact:med | effort:med

`MARKO_RUN_CLAIM_SETS=0` is the documented kill switch for the server-issued claim-set channel, and it is meant to leave a working E1 wire behind it. Measured on marko-ecommerce's appscape battery (browser-driven, curl-replay byte authority, MARKO_SRC build — magnitudes not canonical, the pass/fail pattern is): with the channel ON the battery is 22/22 at the shipped defaults (96-bit digests, `echoValuesCap` 720). With `MARKO_RUN_CLAIM_SETS=0` the same build is 21/22 — "feed: page 1 holds on load-more" elides 26.6% against its >=30% gate. The pre-widening shipped configuration (48-bit digests, `echoValuesCap` 360) passes 22/22 with the channel off, so the kill switch used to be gate-clean and is not any more. Mechanism: at 96 bits an enumerated claim costs 26 B, so the 495 B `E1.` field (`echoValueCap`) carries ~18 records instead of ~27, and without an id to redeem the committed store server-side the request can only assert that shed subset. Raising `echoValuesCap` to 720 recovers most of it (the feed-prepend gate goes 25.3% -> 57.3% with the channel off) but not the load-more gate. Directions: (a) let the E1 path spend more of the 511 B field on values when no claim-set id is in play, (b) have the client rotate which store records it echoes across hops so coverage accumulates, or (c) treat the narrower digest as the kill switch's companion setting and drop `MARKO_PERSISTED_DIGEST_WIDTH` to 8 when the channel is disabled. Re-verify by building marko-ecommerce and running `MARKO_RUN_CLAIM_SETS=0 node scripts/validate/appscape-probe.mjs`.

## Lazy-island shells are outside the static shell manifest — a live wire shell per navigation

`packages/run/src/vite/utils/static-shells.ts`; codegen route shell floor | 2026-07-28 | impact:med | effort:med

Static shell collection walks the route's eager chunk closure, so a
`load=` lazy island's shell ids are never in `__MARKO_RUN_SHELLS__` —
every persisted navigation that re-delivers the island's branch ships
its wire shell live (measured 198 B/nav for the docs `related` widget;
the appscape route-floor check had to be rescoped to allow it). For
content archetypes that lean on lazy islands this is a per-nav tax the
manifest exists to avoid. Candidate fix rides the dual-entry artifact
design: artifacts report owned shell ids as metadata per activation
domain, letting the manifest cover lazy-domain shells the client can
claim once the artifact has loaded (or immediately, since shells are
just [template, walks] strings the eager manifest could carry). Until
then the docs gate pins the cost (≤1 live shell, ≤250 B per patch).

## Static shell manifest repeats shared tags' held ids per route

`packages/run/src/vite/utils/static-shells.ts` › per-route held-id closure | 2026-07-28 | impact:med | effort:med

The route-scale probe (persisted-pages-scratch/route-scale, gate 4)
measured the shared-template shape: a tag shared by every route
contributes its held shell ids to EVERY route's manifest entry — ids do
not dedupe across routes (2 ids/route vs 1 on the flat shape, +43%
manifest bytes on a docs-at-scale layout where hundreds of routes share
one template). At ~14 raw B/held id this is linear but pays the shared
closure N times. The dual-entry artifact design's capability metadata
(artifact → shell ids, deduped by construction) is the structural fix;
short of that, a shared-pool encoding (route → indices into a global id
table) would remove the repetition. Also from the same probe: overall
build time is superlinear in route count (marginal 19→33 ms/route to
N=1000, all shapes) — likely bundler graph cost over ~3N chunks; worth
profiling before any route-scale budget is enforced on CI.

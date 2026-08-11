# Cleanup

Duplication, dead code, inconsistencies, refactor opportunities. Format and rules: [README.md](README.md).

## Wire the real `build.assetsDir` into the Netlify edge entry's `excludedPath`

`packages/adapters/netlify/src/default-edge-entry.ts` › `config` | 2026-08-11 | impact:low | effort:med

The edge entry's `excludedPath: ["/assets/*"]` hardcodes Vite's default `build.assetsDir`, so a project that overrides `assetsDir` invokes the edge function for every asset request; each still serves correctly via `context.next()`, it just loses the skip. The entry is a static file copied by `getEntryFile()`, so honoring the option means templating the entry at build time (or generating the config from the resolved Vite config) — plumbing that doesn't exist today.

## Build the crawler's initial queue from the deduped `seen` set, not the raw start-path array

`packages/adapters/static/src/crawler.ts` › `crawl` | 2026-07-18 | impact:low | effort:low

`crawl()` computes `startPaths = paths.map(resolvePath).concat(notFoundPath).filter(Boolean)`, seeds `seen = new Set(startPaths)` (deduplicated, and used to guard links discovered mid-crawl at crawler.ts:36 and redirect targets at crawler.ts:93), but then builds the work list as `queue = startPaths.map(visit)` over the raw array (crawler.ts:152). So duplicates in `startPaths` each spawn a `visit()`, unlike links found during crawling which are deduped through `seen`. `pathsToVisit` in `buildEnd` can legitimately contain duplicates: it pushes every param-free route path and then appends `options.urls` without dedup (index.ts:128-138), so a path that is both an ordinary param-free route and listed in `urls` is visited twice. For an expensive `200` param-free page that means two renders both writing the same `dist/public/*.html`, racing each other and doubling render cost (observed as a doubled crawl for such a path). Fix: seed the queue from the deduped set (`queue = [...seen].map(visit)`) or dedup `pathsToVisit` in `buildEnd`. Each duplicate visit also lands in its own bucket of the `CrawlResults` `crawl` now returns, so the crawl summary it logs counts such a path once per duplicate and overstates how much of the site was crawled.

## Remove or wire up the dead `unusedFiles` set in the route builder

`packages/run/src/vite/routes/builder.ts` › `buildRoutes` | 2026-07-18 | impact:low | effort:low

`const unusedFiles = new Set<RoutableFile>()` (`builder.ts:82`) is maintained but never consumed. It gets an `.add` for every layout/middleware encountered (`:199`, `:207`) and a `.delete` when one is bound to a route (`:278`, `:284`), but the set is never read, iterated, returned, or logged — `buildRoutes` returns `{ list, middleware, special }` without it (`:175-179`), confirmed by grepping `packages/run/src/vite/` for `unusedFiles` (only those five sites exist). After `traverse()` completes, any leftover entries — layouts/middleware declared but never applied to a route — are simply discarded. Either drop the set and its four maintenance sites, or consume it to warn about unused layouts/middleware. The latter is the same missing diagnostic that lets an orphaned `+meta` pass silently (see the dx finding on page-less `+meta`), so wiring it up would close both gaps at once; deleting it is a no-behavior-change cleanup.

## Fix the tsconfig-detection glob: `.tsconfig*` matches nothing real and `jsconfig.json` projects never get route types

`packages/run/src/vite/plugin.ts` › `writeTypesFile` | 2026-07-18 | impact:low | effort:low

`writeTypesFile` only emits `.marko-run/routes.d.ts` when `globFileExists(root, "{.tsconfig*,tsconfig*.json}")` matches. The `.tsconfig*` alternative matches hidden files named `.tsconfig…`, a convention no tool uses — it reads like a typo for `jsconfig*.json`, which the glob currently misses, so JS projects with a `jsconfig.json` never get the generated route types that power the typed `Run` namespace in editors (verified: dev with only `jsconfig.json` produces no `.marko-run/` directory at all; renaming it to `tsconfig.json` generates `routes.d.ts`). VS Code's JS language service consumes `.d.ts` files through jsconfig, so include `jsconfig*.json` in the pattern and drop the `.tsconfig*` branch.

## Show "handler" in the build routes table only for verbs the handler exports

`packages/run/src/vite/utils/log.ts` › `logRoutesTable` | 2026-07-18 | impact:low | effort:low

`logRoutesTable` pushes "handler" into a row's entry chain whenever `route.handler` exists, regardless of verb: a route with `+page.marko` and a `+handler.ts` exporting only `POST` prints its GET row as `handler -> page`, implying a GET handler runs before the page when none exists. The per-verb information is already available — `getVerbs` derives verbs from `route.handler?.verbs` (packages/run/src/vite/utils/route.ts:13) — so the cell could check `route.handler.verbs.includes(verb)` before pushing. Cosmetic, but the table is the main at-a-glance view of each route's execution chain.

## Read the banner version at runtime instead of inlining npm_package_version at build time

`packages/run/scripts/build.ts` › `opts` | 2026-07-18 | impact:low | effort:low

The startup banner (`packages/run/src/adapter/utils.ts:38`) reads `process.env.npm_package_version`, which esbuild `define` freezes at package-build time; the published `0.11.0-rc.10` tarball contains the literal `v${"0.11.0-rc.9"}` in `dist/adapter/index.js`, so every rc.10 install printed the previous version at startup (verify with `npm pack @marko/run@0.11.0-rc.10` and grep the dist). The root `@ci:version` script runs the build before `changeset version`, so any release that publishes a dist built before the bump ships a stale banner again. Read the version from the package's own package.json at runtime, or have release CI assert the inlined value matches the manifest.

## Reconcile the two in-flight-slot guards in the dev request logger so the `⁺` slot stops leaking

`packages/run/src/adapter/logger.ts` › `logger` | 2026-08-03 | impact:low | effort:low

The `logger` middleware claims an in-flight slot with `if (index < IdChars.length)` but releases it in `done()` with `if (index < 10)`. Index 10 is the `⁺` overflow marker, so the first time 11 requests are in flight at once its bit (1024) is set and never cleared: `inFlight` is stuck at 1024 for the rest of the dev server's life, and every later 11-way concurrent burst computes `index === 11`, reads `IdChars[11]` as `undefined`, and string-concatenates that into the log line. Driving `logger()` with two successive bursts of 11 concurrent requests shows it: the first prints `━▶⁺ GET /… 200`, the second and every one after print `━━▶undefined GET /… 200`, and it never recovers (the same `undefined` already appears at 12 concurrent requests even before the leak). `⁺` is meant to be a shared overflow label that never claims a bit, so both guards should derive from one constant — `index < IdChars.length - 1` — after which `inFlight` caps at 1023 and the id can never be `undefined`. Dev-only: `devServer.middlewares.use(logger())` in `packages/run/src/adapter/dev-server.ts` is the sole call site.

## Delete the unreachable `.marko` special cases in the Vite plugin's `resolveId`/`load`/`configureServer`

`packages/run/src/vite/plugin.ts` › `resolveId` | 2026-08-03 | impact:low | effort:low

Every `virtualFiles` key ends in `.js`: all eight `virtualFiles.set` sites write `getRouteVirtualFileName(route)` (`__marko-run__<key>.js`, `packages/run/src/vite/utils/route.ts`), `MIDDLEWARE_FILENAME`, or `ROUTER_FILENAME`, and the client-build replay in `buildStart` restores those same keys from the persisted store; generated page templates are real files at `<build.outDir>/.marko-run/<key>.marko` and can never carry the `__marko-run__` prefix, since `replaceInvalidFilenameChars` in `packages/run/src/vite/routes/builder.ts` rewrites `_` to `-`. Three `.marko` special cases are therefore inert: the `importee.endsWith(".marko") && importee.includes(relativeEntryFilesDirPosix)` branch in `resolveId`, which every page route does hit (`import page from "./dist/.marko-run/<key>.marko"`) yet can only fall through to `return undefined` because `virtualFiles.has()` never matches — and whose `path.resolve(root, "." + importee)` silently rewrites `./dist/…` to a path one directory _above_ the project root; the `|marko` alternative plus the `!id.startsWith(entryFilesDirPosix)` guard on `load`'s `return ""` fallback; and the always-true `if (!file.endsWith(".marko"))` filter over `virtualFiles.keys()` in `configureServer`. They are left over from before route templates moved out of `virtualFiles` onto disk; dropping them is behavior-preserving for every id the framework emits and retires the last use of `relativeEntryFilesDirPosix`. Note that the bugs.md entry "Invalidate the `.marko` server-entries when a `+layout` is added" and the dx.md entry on route-add full reloads both describe that `configureServer` filter as skipping the `.marko` server-entries — those modules are not in `virtualFiles` at all, so removing the filter changes nothing and a real fix must invalidate them through the module graph.

## Delete the abandoned routes-explorer scaffolding; it still ships in every published `@marko/run` tarball

`packages/run/scripts/build.ts` › `copy` | 2026-08-03 | impact:low | effort:low

`packages/run/src/components/routes-explorer/+page.marko` (literally `<h1>Hello World!!</h1>`) and its sibling `+layout.marko` are leftovers from the in-plugin route explorer added in #57 and untouched since; the only reference left anywhere in the repo is the commented-out `sources`/`explorerRoutesDir` block at the top of `buildVirtualFiles` in `packages/run/src/vite/plugin.ts`, and the feature long ago moved to the separate `@marko/run-explorer` package that `packages/run/src/adapter/index.ts` dynamically imports behind `MR_EXPLORER=1`. They still ship: `packages/run/scripts/build.ts` passes `"components"` to its `copy(...)` call and `package.json` lists `dist` in `files`, so `npm pack --dry-run` reports `dist/components/routes-explorer/+layout.marko` and `+page.marko` among the published files — dead weight in every install, and a confusing hit for anyone grepping a node_modules copy for route files. Delete `packages/run/src/components/` and the `"components"` entry in `scripts/build.ts` in the same change (the `copy` helper `lstat`s each source and would throw on a missing directory), and drop the commented block in `buildVirtualFiles`.

## Delete the seven unreferenced exports across the vite/runtime/adapter modules and `getImporters`' unused `fileName` parameter

`packages/run/src/runtime/internal.ts` › `notHandled` | 2026-08-03 | impact:low | effort:low

A TypeScript reference search across every `.ts` file in `packages/` and `examples/` finds no consumer for seven declared symbols: `notHandled` and `notMatched` in `packages/run/src/runtime/internal.ts` (the lowercase helpers only — the uppercase `NotHandled`/`NotMatched` symbols declared in the same file are imported by the generated router and must stay), `isRoutableFile` in `packages/run/src/vite/routes/builder.ts`, `Writer.writeBlock` in `packages/run/src/vite/codegen/writer.ts` (interface member plus implementation, not the used `writeBlockStart`/`writeBlockEnd`), `WalkOptions.onDir` in `packages/run/src/vite/routes/walk.ts`, `StartServer` in `packages/run/src/vite/types.ts`, and `MarkoRunDevAccessor` in `packages/run/src/adapter/index.ts`. Separately, `getImporters` in `packages/run/src/vite/plugin.ts` declares a `fileName` parameter whose only reference is its own recursive call, so the parameter and the argument at its single call site (the dev watcher's `change` handler) can both go — `noUnusedParameters` misses it precisely because the recursion counts as a read. Dropping `onDir` is behavior-preserving (it is destructured in both `createFSWalker` and `createTestWalker` but never supplied, and `onDir?.() !== false` is unconditionally true when unset), but it is also the hook a fix for catch-all-directory traversal would reach for, so settle that question before deleting it. Only `MarkoRunDevAccessor` sits on a published entry point (`./adapter`), so its removal is the one warranting a changeset; the rest are internal and safe to delete outright.

## Measure or delete the always-zero route build/render timings

`packages/run/src/vite/plugin.ts` › `markoRun` | 2026-08-03 | impact:low | effort:low

`markoRun` initializes `let times: TimeMetrics = { routesBuild: 0, routesRender: 0 }` and hands it to `adapter.routesGenerated` as `meta: { buildTime, renderTime }`, but nothing ever assigns those fields — the only other references are the round-trip through the persisted `RouteData` store (`times = routeData.times` in `buildStart`, `times` written back in `writeBundle`). The `performance.now()` deltas that populated them were deleted in commit 411ea1f2 (#69), which left the type, the store round-trip and the explorer UI in place; a production build with `MR_EXPLORER=1` writes `"meta":{"buildTime":0,"renderTime":0}` into `packages/run/.cache/explorer/data.json`, so `packages/explorer/src/routes/+page.marko` always renders `Build time: 0.00ms / Render time: 0.00ms`. Either restore the deltas around the `buildRoutes` call in `buildVirtualFiles` and the codegen loop in `renderVirtualFiles` (both memoized via `??=`, so a timing covers only the first build per invalidation), or drop `TimeMetrics`, `RouteData.times` and `RouteGenerationData` in `packages/run/src/vite/types.ts` plus the explorer's Overview block — `RouteGenerationData` is re-exported from `packages/run/src/vite/index.ts`, so removing it is a public type change.

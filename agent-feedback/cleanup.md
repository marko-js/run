# Cleanup

Duplication, dead code, inconsistencies, refactor opportunities. Format and rules: [README.md](README.md).

## Build the crawler's initial queue from the deduped `seen` set, not the raw start-path array

`packages/adapters/static/src/crawler.ts` › `crawl` | 2026-07-18 | impact:low | effort:low

`crawl()` computes `startPaths = paths.map(resolvePath).concat(notFoundPath).filter(Boolean)`, seeds `seen = new Set(startPaths)` (deduplicated, and used to guard links discovered mid-crawl at crawler.ts:36 and redirect targets at crawler.ts:93), but then builds the work list as `queue = startPaths.map(visit)` over the raw array (crawler.ts:152). So duplicates in `startPaths` each spawn a `visit()`, unlike links found during crawling which are deduped through `seen`. `pathsToVisit` in `buildEnd` can legitimately contain duplicates: it pushes every param-free route path and then appends `options.urls` without dedup (index.ts:128-138), so a path that is both an ordinary param-free route and listed in `urls` is visited twice. For an expensive `200` param-free page that means two renders both writing the same `dist/public/*.html`, racing each other and doubling render cost (observed as a doubled crawl for such a path). Fix: seed the queue from the deduped set (`queue = [...seen].map(visit)`) or dedup `pathsToVisit` in `buildEnd`.

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

# Cleanup

Duplication, dead code, inconsistencies, refactor opportunities. Format and rules: [README.md](README.md).

## Build the crawler's initial queue from the deduped `seen` set, not the raw start-path array

`packages/adapters/static/src/crawler.ts` › `crawl` | 2026-07-18 | impact:low | effort:low

`crawl()` computes `startPaths = paths.map(resolvePath).concat(notFoundPath).filter(Boolean)`, seeds `seen = new Set(startPaths)` (deduplicated, and used to guard links discovered mid-crawl at crawler.ts:36 and redirect targets at crawler.ts:93), but then builds the work list as `queue = startPaths.map(visit)` over the raw array (crawler.ts:152). So duplicates in `startPaths` each spawn a `visit()`, unlike links found during crawling which are deduped through `seen`. `pathsToVisit` in `buildEnd` can legitimately contain duplicates: it pushes every param-free route path and then appends `options.urls` without dedup (index.ts:128-138), so a path that is both an ordinary param-free route and listed in `urls` is visited twice. For an expensive `200` param-free page that means two renders both writing the same `dist/public/*.html`, racing each other and doubling render cost (observed as a doubled crawl for such a path). Fix: seed the queue from the deduped set (`queue = [...seen].map(visit)`) or dedup `pathsToVisit` in `buildEnd`.

## Remove or wire up the dead `unusedFiles` set in the route builder

`packages/run/src/vite/routes/builder.ts` › `buildRoutes` | 2026-07-18 | impact:low | effort:low

`const unusedFiles = new Set<RoutableFile>()` (`builder.ts:82`) is maintained but never consumed. It gets an `.add` for every layout/middleware encountered (`:199`, `:207`) and a `.delete` when one is bound to a route (`:278`, `:284`), but the set is never read, iterated, returned, or logged — `buildRoutes` returns `{ list, middleware, special }` without it (`:175-179`), confirmed by grepping `packages/run/src/vite/` for `unusedFiles` (only those five sites exist). After `traverse()` completes, any leftover entries — layouts/middleware declared but never applied to a route — are simply discarded. Either drop the set and its four maintenance sites, or consume it to warn about unused layouts/middleware. The latter is the same missing diagnostic that lets an orphaned `+meta` pass silently (see the dx finding on page-less `+meta`), so wiring it up would close both gaps at once; deleting it is a no-behavior-change cleanup.

## Collapse the identical if/else in `writeRouteEntryHandler` route-entry codegen

`packages/run/src/vite/codegen/index.ts` › `writeRouteEntryHandler` | 2026-07-18 | impact:low | effort:low

`writeRouteEntryHandler` (`codegen/index.ts:231-249`) branches on `if (page && (verb === "get" || verb === "head"))` but the `if` and `else` bodies are byte-identical — both run `writer.writeBlockStart(\`export function ${verb}${index}(context) {\`)` (`:245-249`) — so the condition emits the same code either way and is dead. This runs on every `marko-run build`/`marko-run dev`for any route with a page. The meaningful page/verb dispatch happens later at`:253` (`page && (verb === "get" || "head" || "post")`); collapse `:245-249`to a single unconditional`writeBlockStart`, or give one arm a genuinely different body if a variation was intended (it reads as leftover from an abandoned one). Pure readability/dead-code cleanup, no behavior change.

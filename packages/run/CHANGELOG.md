# @marko/run

## 0.11.12

### Patch Changes

- 0aa684a: `context.body` is now only defined when the route's merged options include a `json`/`form` validator — a limits-only option (e.g. `maxBytes` in middleware) no longer exposes an unvalidated body — and the cheatsheet documents the plain-function validator pattern.

## 0.11.11

### Patch Changes

- ddc91c0: Improve agent- and editor-facing typings: mark every `MarkoRun` namespace member `@deprecated` with its `Run` replacement, document the verb helpers, validation options, and context properties with JSDoc, and point the generated `routes.d.ts` header at the shipped cheat sheet.

## 0.11.10

### Patch Changes

- 57a5ffd: Options declared inside an array `+handler`/`+middleware` export (e.g. `export const POST = [Run.POST({ json: schema }, fn), other]`) now apply; previously the validator never ran and `context.body` stayed undefined. Reusing a handler in single-element arrays no longer mutates it.
- 339e971: Requests whose `Content-Type` matches no configured body option now respond 415 instead of being parsed by the form fallback and skipping validation.
- 6f1f8ac: Malformed request bodies (invalid JSON, bad encoding, unparsable multipart) now respond 400 and bodies exceeding the configured size limits respond 413, instead of surfacing as server 500s.
- b39dfce: Dev no longer serves endless `504 Outdated Optimize Dep` for client dependencies when a multi-environment plugin (e.g. `@cloudflare/vite-plugin`) shares the dev server, on Vite 8.1.4+.
- 3bbdcda: `marko-run --version` and the startup banner report the installed package version instead of `0.0.1` / an inlined build-time value.
- f0ad866: Deduplicated dev-server errors print their message line again instead of a bare stack trace.
- 5afc8a4: Fix restored route files intermittently returning HTTP 500 responses in dev until the server restarts.
- d0f735c: Fix intermittent dev-server 500s when app code reachable from middleware imports `@marko/run/router`.
- 501b0c5: `Run.href(path, options)` with a nullish options value no longer throws in production client builds.
- f2fa582: `Run.href` now omits undefined `search` values instead of serializing them as `?key=undefined`. Nested `Run.href` calls no longer corrupt the build-time rewrite.
- c8a31d4: Options declared in `+middleware` no longer leak between routes, and a handler declaring only a size limit keeps the middleware's validator. A key explicitly set to `undefined` now overrides the inherited option; an absent key leaves it in place.
- e0f5860: The servers spawned by `marko-run preview` and `marko-run dev` now shut down when the CLI receives SIGINT or SIGTERM; previously they survived the CLI and kept their port.
- 79f56d9: Support the QUERY HTTP method (RFC 10008): handlers can export `QUERY`, and it participates in routing, typed options/body validation, and the route explorer. Like POST, a QUERY handler's `next` renders the page when the route has one.
- 820c17c: `context.render` now merges a caller-supplied init with the HTML defaults, so passing a status or extra headers no longer drops the `content-type`.
- 62b2255: Stop warning that Marko's colocated companion files, such as `+page.style.css`, are not routable.
- dc33588: Routes with non-ASCII or otherwise URL-encoded static segments now match their percent-encoded request paths instead of silently 404ing.
- 3525489: Escape string literals in the generated router, so route directories containing quotes or other special characters build and match correctly.
- ef9a8db: `throw null` in a handler no longer crashes the dev server; it now skips handling the request in dev the same way it does in production.
- 1f3b553: Apply the configured `trailingSlashes` policy through the public `match`/`invoke` pair, not just the generated `fetch`, so the same app no longer serves duplicate-content URLs depending on how it is mounted. Also simplifies the trailing-slash checks in generated routers.
- 57a5ffd: Validation options from a verb-specific middleware (e.g. `Run.POST({ search, form })`) no longer apply to verbs the middleware doesn't run on; GET-stamped options still serve HEAD.
- Updated dependencies [79f56d9]
  - @marko/run-explorer@2.0.5

## 0.11.9

### Patch Changes

- 64c81e9: Keep one deleted route file from wedging the dev server. Deleting a `+page`/`+handler` removed the route's generated template from disk while the dev watcher actively poked the deleted route's own modules with synthetic change events, so an adapter that eagerly re-evaluates invalidated modules reloaded an id the plugin answered with `undefined`, and every SSR route 500'd with "Failed to load url ... Does the file exist?" until a manual restart. The watcher no longer touches a deleted file's module chain, and a stale reload of a vanished generated template now answers an empty module instead of failing the whole request graph. Re-creating a deleted route file also now refreshes the route table — the watcher used to poke the re-added file's stale module chain, which the router was no longer connected to, so the restored route kept answering 404 until an unrelated rebuild.
- 5b67125: Fix HEAD requests on routes with a `Run.GET` handler.

  Two bugs combined to break auto-generated HEAD handling: `call` compared a handler's `"GET"` verb stamp against `context.method` (`"HEAD"`) and skipped the handler entirely, leaving `context.data` empty and causing the page template to run with missing data; and `context.render` built and streamed the full template even for HEAD, where the body is discarded anyway.

  `call` now treats a `GET`-stamped handler as matching a HEAD request — an explicit `HEAD` export gets its own entry so there is no double-run risk. `context.render` returns a no-body response immediately for HEAD, so the page template never executes and any data the GET handler placed in `context.data` is used only for response headers.

  `createMiddleware` no longer sets `Content-Length: 0` on HEAD responses or 204/304 statuses. RFC 9110 §8.6 forbids the header on 204, and on HEAD it falsely advertises an empty resource to CDNs and uptime monitors.

- 81c4666: Make a wrong verb export fail loudly instead of silently answering 204. Route verbs are discovered from export names alone, so two ordinary mistakes produced routes that looked wired up and answered `204 No Content` with zero diagnostics: a truthy non-function export (`export const GET = 42`, or an accidental object after a refactor) degraded to a no-op handler, and the classic copy-paste rename `export const GET = Run.POST(...)` registered a GET route whose handler the runtime then refused to run for GET requests. `normalizeHandler` now knows which export it is normalizing and throws a clear error for both — at module load in dev (a 500 naming the export and the factory) and at server startup in production, while a promise-wrapped handler rejects with the same error on its first call instead. `Run.ALL` handlers remain valid under any verb export, and a nullish export keeps its previous no-op behavior.
- 58baddf: Give each dev server its own working HMR websocket. Vite's middleware mode binds a fixed default port, so a second `marko-run dev` instance on the same machine failed to bind it — with the error message swallowed — and its live reload silently connected to the first instance. A dev server whose config names no HMR port (nor a server or client port to honor) now keeps Vite's default port while it is free and allocates a free one otherwise.
- 60efda4: Accept a bare truthy `json`/`form` handler option — `Run.POST({ form: true }, handler)` — as "parse the body with the defaults". The option was probed with `"~standard" in option` to tell a Standard Schema from an options object, and `in` throws on a primitive, so an untyped project writing the natural `form: true` got an opaque 500 out of the runtime's option merging instead of a parsed body. The types already forbid the primitive, so type-checked projects are unaffected. The same policy now applies one level down: a `params`, `search`, or nested `validator` value that is neither a function nor a Standard Schema is treated as no validator, where it previously got wrapped as a schema and crashed on the first validation instead.
- cc6098f: Report a clear error in dev when a handler returns something other than a `Response`. Returning data directly (the `return { items }` habit) previously reached the node adapter, which failed with `headers is not iterable` from its own internals and named neither the route nor the contract. The dev-mode guard now names the verb, the route, and what to return instead.

  Also register the `NotHandled`/`NotMatched` sentinels with `Symbol.for`. A build can load more than one copy of the runtime module, and a sentinel returned from user code was not recognized by another copy's comparison — flowing into the adapter as if it were a response.

- b741de2: Abort `request.signal` and cancel the response stream when a client disconnects. The node request path built its `Request` without a signal, so `request.signal.addEventListener("abort", ...)` — the standard way to notice a client is gone — could never fire, and the only cancellation was a `res.destroyed` check reached between chunks. A stream that had gone idle never reached it, so its timers and upstream work kept running after the client left. Affects the dev server, `marko-run preview` and `@marko/run-adapter-node` alike, since all three share this middleware. Along the way `getRender` — the helper `@marko/run/adapter/middleware` exported for picking the stashed Marko render over the body — is folded into the new `getBodyReader`, which makes the same choice and hands back the `read`/`cancel` pair the middleware itself writes with.
- edc7a02: URL-decode catch-all (`$$`) route params. Dynamic (`$`) segments were decoded but the catch-all was handed through raw, so the two param kinds disagreed and `Run.href`'s percent-encoding had no matching decode — `Run.href` for `["docs", "café"]` produced `/docs/caf%C3%A9`, and the linked page read back `params.rest === "docs/caf%C3%A9"`. The catch-all now decodes like every other param, completing the href round-trip. A request whose catch-all carries a malformed percent sequence now fails the same way it always has for dynamic segments.
- 7bd7b09: Type `Route["body"]` as `undefined` for verbs that cannot carry one. Without a typed validator, `body` widened to `undefined | Promise<unknown>` for every verb, so a GET page's `$global.body` and `GetContext(...).body` invited `await` handling the runtime never satisfies — it only creates a body thenable for POST/PUT/PATCH with a `json`/`form` option configured — while the very same file's `Run.GET` handler correctly typed `ctx.body` as `undefined`. The hedge now only survives when the def's method can carry a body; the fully generic `Route`/`Context` (a `ctx.parent`, say) keeps it, since a generic context may belong to a bodied route.
- cb62270: Fix the dev server not applying an added or removed `+layout.marko` until an unrelated edit or restart. The generated route entry templates are now explicitly invalidated when their content changes, so layout composition updates take effect immediately.

## 0.11.8

### Patch Changes

- 0dc1ab1: Stop forcing both `import` and `require` into `resolve.conditions`. Vite already appends whichever one matches the importer, so listing both made a dependency that declares `require` before `import` in its `exports` map resolve to its CommonJS build.
- 0dc1ab1: Apply the build's `resolve.conditions` per environment. Vite drops the key for every non-client environment, so setting it at the top level left the SSR build on Vite's defaults and never applied the `node` condition it was meant to get. The accompanying `resolve.mainFields` override is dropped, having reproduced Vite's own per-environment defaults exactly.
- a1bb588: Declare direct dependencies required by the Vite integration under pnpm.

## 0.11.7

### Patch Changes

- c55399e: Type the optional `url` argument `invoke` already accepts, so passing a rewritten URL no longer needs a cast.
- 615824e: Speed up HTML responses on the Node adapter by writing a page render's HTML strings straight to the socket instead of routing them through a whatwg `ReadableStream`/`Response` body. The public API is unchanged and other adapters still read `response.body` as before.

## 0.11.6

### Patch Changes

- 225c2ee: Ship an LLM-optimized routing reference (`cheatsheet.md`) inside the package and expose it through the `exports` map as `@marko/run/cheatsheet.md`. When a coding agent is driving the terminal, `@marko/run`'s compile-time errors (duplicate routes, invalid route paths, codegen failures) now end with a pointer to the cheat sheet (`Fix guide: READ …/cheatsheet.md before writing a fix.`) so the agent reads the routing conventions before attempting a fix. This mirrors the compiler's own fix-guide (marko-js/marko#3423) for errors thrown by `@marko/run` itself.

## 0.11.5

### Patch Changes

- 0f12e17: Fix `Run.*()` mutating shared handler functions and export internal types to resolve TS2883

  `createDefineHandler` previously assigned the caller-supplied handler directly as the returned
  handler object and then set `.verb` on it, which permanently tagged any reused utility function
  with the first verb it was registered under. Passing the same function to a second `Run.*()` call
  (e.g. a shared handler used in both `Run.GET` and `Run.POST([...])`) would then throw:

  ```text
  Error: Expected verb POST but handler was defined with Run.GET
  ```

  The fix wraps single-function arguments in a new closure so `.verb` is set on the wrapper, leaving
  the original function unmodified and free to be reused across verbs.

  `HandlerTypes`, `NormalizedHandlerFunction`, and `Typed` are now re-exported from the package
  root. Without these exports, using the array overload of `Run.*()` on an exported handler constant
  produced TS2883 ("The inferred type cannot be named without a reference to …/runtime/types"),
  because TypeScript could not portably name those types in generated declaration files.

- aaa8987: Warn in dev and build about route files that look routable but silently are not: a `+type` marker matching no routable type (e.g. `+server.js`, a wrong extension like `+page.txt`, a typo'd `+pge.marko`) points at the routable file list, and a `$param` name missing its `+type` suggests the fix. `[flag]` variant groups (e.g. `@ebay/arc`'s `header[mobile+android].js`, or `+page[mobile].marko`) are ignored so they never read as broken routes. The "no http verb exports" warning also names any lowercase verb-like exports it found (e.g. `get`) and shows the `Run.GET(handler)` form.
- 8ad1405: Remove Playwright from the test suite in favor of an in-process jsdom test browser, and make dev/preview server shutdown reliable — faster, less flaky tests.

## 0.11.4

### Patch Changes

- 59c3a4e: Fix a build race where a virtual file (eg. the router behind `@marko/run/router`) could be served as an empty module if the bundler requested it while route rendering was still in flight, producing `IMPORT_IS_UNDEFINED`/`MISSING_EXPORT` diagnostics and a server bundle with an empty router.
- 1cc228d: Detect script route handler and middleware exports in dev by parsing the file in isolation instead of transforming it through the client environment, which pulled each file's server-only import graph through the browser pipeline and errored on imports only the server environment can resolve (e.g. `cloudflare:workers`). `.marko` handlers still compile through the pipeline before export detection.
- e0daf3c: Exclude the virtual `@marko/run/router` module from dependency optimization in every environment, so an environment that scans a server entry (e.g. a Cloudflare Workers environment) no longer fails its dependency scan trying to load the virtual file from disk.

## 0.11.3

### Patch Changes

- 53fc9c1: Remove the runtime's `node:url` import in favor of the global `URLSearchParams` (available everywhere the runtime runs), so the router no longer requires Node compatibility on edge targets like Cloudflare Workers.

## 0.11.2

### Patch Changes

- 2391732: Avoid Node's `DEP0190` deprecation warning by joining the command and args into a single string instead of passing an args array alongside `shell: true` when spawning the dev/preview server.

## 0.11.1

### Patch Changes

- afe373c: Revert context to a plain object so its methods and lazy getters survive being spread into `$global`

## 0.11.0

### Minor Changes

- 18ae9fe: Add first-class validation support, data loading pattern and typed url builder

### Patch Changes

- Updated dependencies [18ae9fe]
  - @marko/run-explorer@2.0.4

## 0.10.0

### Minor Changes

- 86eb3fe: Vite 8 support

### Patch Changes

- Updated dependencies [86eb3fe]
  - @marko/run-explorer@2.0.3

## 0.9.7

### Patch Changes

- 0ad5aef: Remove special characters from rollup output asset and entry file names

## 0.9.6

### Patch Changes

- 5b6c12f: Support verb-specific overrides for JSON and object meta data

## 0.9.5

### Patch Changes

- e20eba4: Remove dependency on @babel/types

## 0.9.4

### Patch Changes

- 87c1807: Use Marko API of top layout for route entry files

## 0.9.3

### Patch Changes

- b246743: Fix: allow adapter defined runtime changes trigger to update in dev mode

## 0.9.2

### Patch Changes

- 10b2f07: Fix rollup output options not being merged correctly when defined by adapter

## 0.9.1

### Patch Changes

- a6d1220: Add isEntryTemplate method to adapters which allows them to filter which marko templates can be entries

## 0.9.0

### Minor Changes

- a3d03d1: (breaking) Only use known marko files from routes as server entries. Add api for other vite plugins to inform about external routes.

## 0.8.1

### Patch Changes

- db570ab: Fix error payload sent to client in dev mode

## 0.8.0

### Minor Changes

- 69edb49: Support Vite 7

### Patch Changes

- Updated dependencies [69edb49]
  - @marko/run-explorer@2.0.1

## 0.7.7

### Patch Changes

- 459f722: fix(adapter-static): updated marko/vite and add missing dependency on htmlparser2

## 0.7.6

### Patch Changes

- 4a5084f: Use mutable response for redirect method

## 0.7.5

### Patch Changes

- c3f2ad7: Use correct routes directory for optimizeDep entries glob

## 0.7.4

### Patch Changes

- 0b22d0b: Fix adapter runtime loading in dev mode

## 0.7.3

### Patch Changes

- 9cf2ea9: Resolve adapter plugins in dev worker

## 0.7.2

### Patch Changes

- c4fa0ce: Add adapter hook to import additional runtime

## 0.7.1

### Patch Changes

- 5e3efe6: Add hook for adapters to inject extra plugins, no longer error if no file-routes are defined

## 0.7.0

### Minor Changes

- 3bdc18e: Add escaping character '`' to route paths
Add context convenience methods: fetch, render, redirect, back
Update static adapter to use `sirv` in preview mode
- faadf30: Default trailing slash behavior to RedirectWithout, and respect in static adapter

### Patch Changes

- @marko/run-explorer@2.0.0

## 0.6.6

### Patch Changes

- 4926e0a: Fix input type generated for layouts

## 0.6.5

### Patch Changes

- a8580d7: Update Netlify adapter to latest, minor other fixes

## 0.6.4

### Patch Changes

- 4dc8a4c: Replace stream with render for 404 and 500 pages

## 0.6.3

### Patch Changes

- d2c8499: Ensure page responses are encoded as ReadableStream, fix Netlify edge function builds, fix Windows issues

## 0.6.2

### Patch Changes

- 15f79b9: Ensure multi-route context params are supersets

## 0.6.1

### Patch Changes

- dd4bc10: Fix gzip/size logging.
- Updated dependencies [2170e27]
  - @marko/run-explorer@1.0.1

## 0.6.0

### Minor Changes

- 3578493: Remove abort signal from request due to memory leaks. Move generated route files out of node_modules into output dir.

### Patch Changes

- @marko/run-explorer@1.0.0

## 0.5.17

### Patch Changes

- e7cd949: Fix chained optional dynamic params

## 0.5.16

### Patch Changes

- 1e558d5: Fix build command failing on Windows

## 0.5.15

### Patch Changes

- c03efd5: Support PATCH, OPTIONS and HEAD http methods

## 0.5.14

### Patch Changes

- 7d7440b: Test release workflow
- ad5dd33: Fix nested flat routes with layouts being shared

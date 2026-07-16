# @marko/run

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

# @marko/run

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

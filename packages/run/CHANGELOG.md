# @marko/run

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

# @marko/run

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

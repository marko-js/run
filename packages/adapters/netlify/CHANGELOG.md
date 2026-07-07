# @marko/run-adapter-netlify

## 3.0.5

### Patch Changes

- 2391732: Avoid Node's `DEP0190` deprecation warning by joining the command and args into a single string instead of passing an args array alongside `shell: true` when spawning the dev/preview server.

## 3.0.4

### Patch Changes

- 18ae9fe: Add first-class validation support, data loading pattern and typed url builder

## 3.0.3

### Patch Changes

- 86eb3fe: Vite 8 support

## 3.0.2

### Patch Changes

- e05ccf6: Update marko run peer dependency

## 3.0.1

### Patch Changes

- 69edb49: Update peer dependency

## 3.0.0

### Patch Changes

- Updated dependencies [3bdc18e]
- Updated dependencies [faadf30]
  - @marko/run@0.7.0

## 2.0.1

### Patch Changes

- 9c835da: Check if netlify CLI is installed before starting preview
- Updated dependencies [4926e0a]
  - @marko/run@0.6.6

## 2.0.0

### Major Changes

- a8580d7: Update Netlify adapter to latest, minor other fixes

### Patch Changes

- Updated dependencies [a8580d7]
  - @marko/run@0.6.5

## 1.0.2

### Patch Changes

- d2c8499: Ensure page responses are encoded as ReadableStream, fix Netlify edge function builds, fix Windows issues
- Updated dependencies [d2c8499]
  - @marko/run@0.6.3

## 1.0.1

### Patch Changes

- 2170e27: Fix release of adapters and explorer
- Updated dependencies [dd4bc10]
  - @marko/run@0.6.1

## 1.0.0

### Patch Changes

- Updated dependencies [3578493]
  - @marko/run@0.6.0

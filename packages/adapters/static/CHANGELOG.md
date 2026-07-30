# @marko/run-adapter-static

## 2.0.8

### Patch Changes

- 6769e8d: Stop crawling `<a download>` links, and honor `rel="nofollow"` (plus `enclosure` and `external`) when it appears alongside other `rel` tokens. A bare `download` attribute parses as an empty string, so the check meant to skip those links only ever matched `download="filename"`, and `rel` was compared as a whole string rather than a token list. Links to files the app server does not serve were followed, and each one wrote the 404 page out under that path.
- 040e33c: Match `<link rel>` against each of its tokens when deciding what to crawl. `rel` is a space-separated token list, but it was compared as a whole string, so a page linked as `rel="alternate stylesheet"` fell through the allowlist and was left out of the static build.
- 8f4f0c3: Resolve crawled links against the page they were found on rather than the origin. A relative href previously lost its directory, so `./sibling` on `/docs/reference/language` was crawled as `/sibling`, which 404s and wrote the 404 page out under that name.

## 2.0.7

### Patch Changes

- cf911bd: Fix a race where the build could complete before crawled pages were fully written to disk, intermittently causing missing or truncated files in the static output.

## 2.0.6

### Patch Changes

- 18ae9fe: Add first-class validation support, data loading pattern and typed url builder

## 2.0.5

### Patch Changes

- 86eb3fe: Vite 8 support

## 2.0.4

### Patch Changes

- 7820bbd: Static adapter crawls non-html files

## 2.0.3

### Patch Changes

- e05ccf6: Update marko run peer dependency

## 2.0.2

### Patch Changes

- 69edb49: Update peer dependency

## 2.0.1

### Patch Changes

- 459f722: fix(adapter-static): updated marko/vite and add missing dependency on htmlparser2
- Updated dependencies [459f722]
  - @marko/run@0.7.7

## 2.0.0

### Minor Changes

- faadf30: Default trailing slash behavior to RedirectWithout, and respect in static adapter

### Patch Changes

- 3bdc18e: Add escaping character '`' to route paths
Add context convenience methods: fetch, render, redirect, back
Update static adapter to use `sirv` in preview mode
- Updated dependencies [3bdc18e]
- Updated dependencies [faadf30]
  - @marko/run@0.7.0

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

- 2440a7f: Add compression to static adapter preview server
- Updated dependencies [3578493]
  - @marko/run@0.6.0

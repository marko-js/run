---
"@marko/run": patch
---

The persisted client route table's template loaders import for side
effects only (`import(...).then(() => 0)`), letting the bundler
tree-shake the template modules' exports — a route wrapper's `$template`
getter interpolates its layout's template export, so a plain dynamic
import was retaining the entire document-shell string (and every
wrapper/layout template and walks string) in the shared eager client
chunk.

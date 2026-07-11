# DX

## Dev-server runtime errors from `.marko` frames should carry the llms.md pointer

`packages/run/src/vite/plugin.ts:1` | 2026-07-11 | impact:med | effort:low

The compile-error fix-guide pointer (shipped in @marko/vite, gated on `marko/llms.md` resolving) has measurably driven agents to read the reference before writing a fix (llm/experiment in marko-js/marko, RESULTS3: 41/44 read, 27/44 repaired-to-pass). But SSR _runtime_ errors during dev carry nothing: a capability sweep (RESULTS5) found agent-written `by=city` loop keys dying with a bare `city is not defined` plus a stack — correct source-mapped `.marko` frame, no guidance. When the dev server surfaces a request-time error whose stack includes a `.marko` frame, appending the same gated pointer ("Fix guide: READ node_modules/marko/llms.md (Marko 6 syntax) before writing a fix.") would extend the one validated moment-of-need channel to the runtime regime where the guided-condition residual failures now live. Related coverage check for @marko/vite: one translator assertion surfacing at SSR request time (`assertNativeHandlerAttr`) arrived without the compile pointer — the wrapper may miss a lazy-compile path.

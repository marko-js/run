# DX

## Warn on high-confidence lookalike route files that are silently non-routable

`packages/run/src/vite/routes/builder.ts:15` | 2026-07-11 | impact:med | effort:med

Only `+`-prefixed names matching `RoutableFileRegex` are routable; everything else in the routes directory is (by design) colocation and is skipped silently. In a controlled test where an LLM generated @marko/run apps without documentation, every wrong guess came from other frameworks' conventions and produced a dev server that boots cleanly and 404s everything, with no hint: `products/[id].marko` and `api/products/[id].js` (SvelteKit/Next bracket params), `+server.js` (SvelteKit), and `guestbook.marko`/`guestbook.js` (page/handler without the `+page`/`+handler` name). Humans migrating from those frameworks will hit the same wall. A dev-mode warning for high-confidence lookalikes only — a file starting with `+` that matches no routable type, and `[param]`-bracketed file/directory names — e.g. "`src/routes/+server.js` is not routable; handlers are named `+handler.js`" / "dynamic segments use `$id`, not `[id]`" would keep colocation quiet while catching the recurring cases.

## Name the offending export in the "no http verb exports" warning

`packages/run/src/vite/plugin.ts:301` | 2026-07-11 | impact:low | effort:low

When a `+handler` file exports `get`/`post` (lowercase, the SvelteKit convention) the build warns "Did not find any http verb exports in ... - expected GET, HEAD, POST, ..." without saying what it _did_ find, and the request then 404s. Echoing the near-miss ("found `get` — verb exports must be uppercase `GET`") turns a puzzling warning into a one-edit fix; observed as a recurring failure mode in LLM-generated handlers, and plausible for anyone arriving from SvelteKit.

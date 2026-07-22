---
"@marko/run-adapter-cloudflare": minor
---

Add a Cloudflare adapter for developing, previewing and deploying @marko/run apps on Cloudflare Workers.

It wraps `@cloudflare/vite-plugin`, pinned to Vite's `ssr` environment:

- `marko-run dev` runs the app inside workerd, so route handlers get real
  local bindings (`platform.env` from the project's Wrangler config and
  `.dev.vars`), `platform.ctx` and `platform.cf` — matching production.
- Builds emit `dist/ssr` (the Worker plus a complete `wrangler.json`) and
  `dist/client` (static assets), and write a redirected configuration so a
  bare `wrangler deploy` works; a project-level Wrangler config is optional
  and keeps its bindings/vars when present.
- `marko-run preview` serves the build with `wrangler dev` against the
  emitted config.

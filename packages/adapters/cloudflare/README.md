<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-cloudflare
	<br/>
</h1>

Preview and deploy [@marko/run](../../run/README.md) apps to Cloudflare Workers/Pages

## Installation

```sh
npm install @marko/run-adapter-cloudflare
```

That's all the setup required — Marko Run automatically discovers an installed adapter and uses it, so you **don't** need to register it in your Vite config. See [Configuration](#configuration) if you want to build for Cloudflare Pages instead of the default Workers target.

`wrangler` is used to preview and deploy your app; install it as a dev dependency:

```sh
npm install -D wrangler
```

## Deploying

Build your app and deploy the output with the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/):

```sh
npm run build
npx wrangler deploy -c dist/wrangler.json
```

`marko-run build` produces the following in your output directory (`dist` by default):

- `_worker.js` — the bundled server entry
- `public/` — your app's static assets
- `wrangler.json` — a generated starter config (only written when no `wrangler.toml`/`wrangler.json`/`wrangler.jsonc` exists at your project root)

To use your own bindings (KV, D1, R2, secrets, custom name, routes, etc.), add a Wrangler config at the root of your project. When present, the adapter will **not** generate one — point it at the build output yourself and deploy with `npx wrangler deploy`:

```jsonc
// wrangler.jsonc
{
  "name": "my-app",
  "main": "./dist/_worker.js",
  "compatibility_date": "2024-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist/public",
    "binding": "ASSETS",
  },
}
```

## Configuration

Marko Run uses this adapter automatically, but you can register it in your Vite config (eg. `vite.config.js`) to pass options — for example, to target [Cloudflare Pages](https://developers.cloudflare.com/pages/) instead of the default [Workers](https://developers.cloudflare.com/workers/):

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import cloudflareAdapter from "@marko/run-adapter-cloudflare";

export default defineConfig({
  plugins: [
    marko({
      adapter: cloudflareAdapter({ mode: "pages" }),
    }),
  ],
});
```

In `"pages"` mode the adapter builds a [Pages Functions "advanced mode"](https://developers.cloudflare.com/pages/functions/advanced-mode/) `_worker.js` and a `_routes.json` into `dist/public`. Deploy the assets directory instead:

```sh
npm run build
npx wrangler pages deploy dist/public
```

## Platform info

The Worker environment, execution context and Cloudflare request properties are available on the `platform` argument of your route handlers:

```ts
import type { CloudflarePlatformInfo } from "@marko/run-adapter-cloudflare";

export const GET = (context) => {
  const { env, ctx, cf } = context.platform as CloudflarePlatformInfo;
  ctx.waitUntil(logRequest(cf));
  return new Response(`Hello from ${cf?.city ?? "the edge"}!`);
};
```

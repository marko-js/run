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

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import cloudflareAdapter from "@marko/run-adapter-cloudflare";

export default defineConfig({
  plugins: [
    marko({
      adapter: cloudflareAdapter(),
    }),
  ],
});
```

The adapter builds for [Cloudflare Workers](https://developers.cloudflare.com/workers/) by default. `wrangler` is used to preview and deploy your app, so install it as a dev dependency:

```sh
npm install -D wrangler
```

## Workers (default)

Running `marko-run build` produces the following in your output directory (`dist` by default):

- `_worker.js` — the bundled server entry
- `public/` — your app's static assets
- `wrangler.json` — a generated starter config (only written when no `wrangler.toml`/`wrangler.json`/`wrangler.jsonc` exists at your project root)

Deploy with:

```sh
wrangler deploy --config dist/wrangler.json
```

To use your own bindings (KV, D1, R2, secrets, custom name, routes, etc.), add a Wrangler config at the root of your project. When present, the adapter will **not** generate one — point it at the build output yourself:

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

## Pages

This adapter can target [Cloudflare Pages](https://developers.cloudflare.com/pages/) instead, building a [Pages Functions "advanced mode"](https://developers.cloudflare.com/pages/functions/advanced-mode/) `_worker.js`:

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

This emits `_worker.js` and a `_routes.json` into `dist/public`. Deploy the assets directory with:

```sh
wrangler pages deploy dist/public
```

## Platform info

The Worker environment, execution context and Cloudflare request properties are available on the `platform` argument of your route handlers:

```ts
import type { CloudflarePlatformInfo } from "@marko/run-adapter-cloudflare";

export const GET = (context, { platform }) => {
  const { env, ctx, cf } = platform as CloudflarePlatformInfo;
  ctx.waitUntil(logRequest(cf));
  return new Response(`Hello from ${cf?.city ?? "the edge"}!`);
};
```

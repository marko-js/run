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

Develop, preview and deploy [@marko/run](../../run/README.md) apps on [Cloudflare Workers](https://developers.cloudflare.com/workers/), powered by the [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/).

## Installation

```sh
npm install @marko/run-adapter-cloudflare
```

That's all the setup required — Marko Run automatically discovers an installed adapter and uses it, so you **don't** need to register it in your Vite config.

`wrangler` is used to preview and deploy your app; install it as a dev dependency:

```sh
npm install -D wrangler
```

## How it works

The adapter wraps `@cloudflare/vite-plugin`, pinned to Vite's `ssr` environment — the one Marko Run builds its server into — so that environment becomes workerd-shaped (resolve conditions, dev module runner, deploy output) while Marko Run keeps owning routing and the linked client/server build.

A Wrangler config at your project root is optional: the adapter supplies the Worker entry and sensible defaults (`compatibility_date`, `nodejs_compat`, an `ASSETS` binding). Add a `wrangler.jsonc` to declare your own bindings, vars, name, routes, etc. — its `main` and `assets` are managed by the adapter, everything else is yours:

```jsonc
// wrangler.jsonc
{
  "name": "my-app",
  "compatibility_date": "2024-11-01",
  "vars": { "MY_VAR": "hello" },
  "kv_namespaces": [{ "binding": "MY_KV", "id": "..." }],
}
```

## Development

`marko-run dev` runs your app inside [workerd](https://github.com/cloudflare/workerd) — the Cloudflare Workers runtime — so dev behaves like production: `platform.env` exposes working local versions of the bindings declared in your Wrangler config (vars, KV, D1, R2, etc., with values from `.dev.vars`), and `platform.ctx` and `platform.cf` are provided by the runtime. Vite HMR works as usual, static assets are served by the dev server, and binding state persists in `.wrangler/state` where it is shared with `wrangler dev`.

## Preview

`marko-run preview` builds the app and serves the build output with `wrangler dev` against the Wrangler config emitted by the build.

## Deploying

`marko-run build` produces in your output directory (`dist` by default):

- `ssr/` — the bundled Worker and an emitted `wrangler.json` describing it (your project config merged with the built entry and asset paths)
- `client/` — your app's static assets

The build also writes a [redirected configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#generated-wrangler-configuration) so a bare `wrangler deploy` picks up the emitted config:

```sh
npm run build
npx wrangler deploy
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

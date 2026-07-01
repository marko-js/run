<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-bun
	<br/>
</h1>

Preview and deploy [@marko/run](../../run/README.md) apps on [Bun](https://bun.sh)

## Installation

```sh
npm install @marko/run-adapter-bun
```

That's all the setup required — Marko Run automatically discovers an installed adapter and uses it, so you **don't** need to register it in your Vite config.

`marko-run build` produces a self-contained server entry at `dist/index.mjs` that uses `Bun.serve`. It handles your app's routes and serves the static assets in `dist/public`, listening on the `PORT` environment variable (defaulting to `3000`).

## Running

Build your app and run the server with the [Bun CLI](https://bun.sh):

```sh
npm run build
bun run dist/index.mjs
```

Deploy the `dist` directory to any Bun host and run it the same way.

## Platform info

The `Bun.serve` server instance is available on the `platform` argument of your route handlers, exposing per-request helpers such as `requestIP`:

```ts
import type { BunPlatformInfo } from "@marko/run-adapter-bun";

export const GET = (context) => {
  const server = context.platform as BunPlatformInfo;
  const ip = server.requestIP(context.request);
  return new Response(`Hello from ${ip?.address ?? "somewhere"}!`);
};
```

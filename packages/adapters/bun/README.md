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

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import bunAdapter from "@marko/run-adapter-bun";

export default defineConfig({
  plugins: [
    marko({
      adapter: bunAdapter(),
    }),
  ],
});
```

Running `marko-run build` produces a self-contained server entry at `dist/index.mjs` that uses `Bun.serve`. It handles your app's routes and serves the static assets in `dist/public` (the server listens on the `PORT` environment variable, defaulting to `3000`).

## Running

```sh
bun run dist/index.mjs
```

## Platform info

The `Bun.serve` server instance is available on the `platform` argument of your route handlers, exposing per-request helpers such as `requestIP`:

```ts
import type { BunPlatformInfo } from "@marko/run-adapter-bun";

export const GET = (context, { platform }) => {
  const server = platform as BunPlatformInfo;
  const ip = server.requestIP(context.request);
  return new Response(`Hello from ${ip?.address ?? "somewhere"}!`);
};
```

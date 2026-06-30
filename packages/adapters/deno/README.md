<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-deno
	<br/>
</h1>

Preview and deploy [@marko/run](../../run/README.md) apps to [Deno](https://deno.com) and [Deno Deploy](https://deno.com/deploy)

## Installation

```sh
npm install @marko/run-adapter-deno
```

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import denoAdapter from "@marko/run-adapter-deno";

export default defineConfig({
  plugins: [
    marko({
      adapter: denoAdapter(),
    }),
  ],
});
```

Running `marko-run build` produces a self-contained server entry at `dist/index.js` that uses `Deno.serve`. It handles your app's routes and serves the static assets in `dist/public` (the server listens on the `PORT` environment variable, defaulting to `3000`).

## Running

```sh
deno run --allow-net --allow-read --allow-env dist/index.js
```

## Deploying

For [Deno Deploy](https://deno.com/deploy), point your project's entrypoint at `dist/index.js` and include the build output, or use [`deployctl`](https://docs.deno.com/deploy/manual/deployctl/):

```sh
deployctl deploy --entrypoint=dist/index.js
```

## Platform info

The `Deno.serve` request info — including the client's network address — is available on the `platform` argument of your route handlers:

```ts
import type { DenoPlatformInfo } from "@marko/run-adapter-deno";

export const GET = (context, { platform }) => {
  const { remoteAddr } = platform as DenoPlatformInfo;
  return new Response(`Hello from ${remoteAddr.hostname}!`);
};
```

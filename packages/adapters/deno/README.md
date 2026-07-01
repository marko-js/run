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

That's all the setup required — Marko Run automatically discovers an installed adapter and uses it, so you **don't** need to register it in your Vite config.

`marko-run build` produces a self-contained server entry at `dist/index.js` that uses `Deno.serve`. It handles your app's routes and serves the static assets in `dist/public`, listening on the `PORT` environment variable (defaulting to `3000`).

## Deploying

For [Deno Deploy](https://deno.com/deploy), build your app and deploy the output with [`deployctl`](https://docs.deno.com/deploy/manual/deployctl/):

```sh
npm run build
deployctl deploy --entrypoint=dist/index.js
```

## Running

To run the built server on Deno anywhere:

```sh
npm run build
deno run --allow-net --allow-read --allow-env dist/index.js
```

## Platform info

The `Deno.serve` request info — including the client's network address — is available on the `platform` argument of your route handlers:

```ts
import type { DenoPlatformInfo } from "@marko/run-adapter-deno";

export const GET = (context) => {
  const { remoteAddr } = context.platform as DenoPlatformInfo;
  return new Response(`Hello from ${remoteAddr.hostname}!`);
};
```

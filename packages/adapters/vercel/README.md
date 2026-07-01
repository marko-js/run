<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-vercel
	<br/>
</h1>

Preview and deploy [@marko/run](../../run/README.md) apps to Vercel Functions/Edge Functions

## Installation

```sh
npm install @marko/run-adapter-vercel
```

That's all the setup required — Marko Run automatically discovers an installed adapter and uses it, so you **don't** need to register it in your Vite config. See [Configuration](#configuration) if you want to build for the Edge runtime instead of the default Node.js Serverless runtime.

## Previewing locally

After building, `marko-run preview` serves the generated `.vercel/output` locally — static assets are served from disk and everything else is handled by the built function, mirroring how Vercel routes requests in production:

```sh
npm run build
npm run preview
```

This runs entirely on your machine: no Vercel account, project link, or Vercel CLI is required.

## Deploying

`marko-run build` produces a [Vercel Build Output API](https://vercel.com/docs/build-output-api/v3) directory at `.vercel/output`, which Vercel deploys directly.

The simplest option is Vercel's Git integration: set your project's build command to `marko-run build` and Vercel picks up `.vercel/output` automatically — no output directory configuration required.

To deploy from your machine with the [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`), build and upload the prebuilt output:

```sh
npm run build
npx vercel deploy --prebuilt
```

Add `--prod` to deploy to production.

## Configuration

Marko Run uses this adapter automatically, but you can register it in your Vite config (eg. `vite.config.js`) to pass options — for example, to build for Vercel [Edge Functions](https://vercel.com/docs/functions/edge-functions) instead of the default Node.js Serverless Functions:

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import vercelAdapter from "@marko/run-adapter-vercel";

export default defineConfig({
  plugins: [
    marko({
      adapter: vercelAdapter({ edge: true }),
    }),
  ],
});
```

## Platform info

The route handler `platform` argument differs by runtime.

For Edge Functions it exposes the request context:

```ts
import type { VercelEdgePlatformInfo } from "@marko/run-adapter-vercel";

export const GET = (context) => {
  const { waitUntil } = context.platform as VercelEdgePlatformInfo;
  waitUntil(logRequest());
  return new Response("Hello from the edge!");
};
```

For Node.js Serverless Functions it exposes the underlying Node request and response objects (`VercelNodePlatformInfo`).

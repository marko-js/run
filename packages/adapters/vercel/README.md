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

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import vercelAdapter from "@marko/run-adapter-vercel";

export default defineConfig({
  plugins: [
    marko({
      adapter: vercelAdapter(),
    }),
  ],
});
```

Running `marko-run build` produces a [Vercel Build Output API](https://vercel.com/docs/build-output-api/v3) directory at `.vercel/output`, which Vercel uses directly when deploying. Set your project's build command to `marko-run build` and Vercel will pick it up — no output directory configuration required.

## Edge Functions

This adapter can be configured to build for Vercel [Edge Functions](https://vercel.com/docs/functions/edge-functions) instead of the default Node.js Serverless Functions:

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

export const GET = (context, { platform }) => {
  const { waitUntil } = platform as VercelEdgePlatformInfo;
  waitUntil(logRequest());
  return new Response("Hello from the edge!");
};
```

For Node.js Serverless Functions it exposes the underlying Node request and response objects (`VercelNodePlatformInfo`).

<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-netlify
	<br/>
</h1>

Preview and deploy [@marko/run](../serve/README.md) apps to Netlify Functions/Edge Functions

## Installation

```sh
npm install @marko/run-adapter-netlify
```

## Usage

For most applications, installing this adapter is all that is needed. Marko Run will automatically discover it and configure it to deploy to Netlify Functions.

## Configuration

Netlify applications require a [`netlify.toml`](https://docs.netlify.com/configure-builds/file-based-configuration/#sample-netlify-toml-file) to configure it. This example is a starting point for Marko Run apps deployed to Netlify Functions.

```toml
[build]
  command = "marko-run build"
  publish = "dist/public"
  functions = "dist"
```

## Edge Functions

This adapter can be configured to build for Netlify [Edge Functions](https://docs.netlify.com/edge-functions/overview/) in the application's Vite config.

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import netlifyAdapter from "@marko/run-adapter-netlify";

export default defineConfig({
  plugins: [
    marko({
      adapter: netlifyAdapter({ edge: true }),
    }),
  ],
});
```

The netlify.toml will also need to specify the edge `edge_functions` directory instead of `functions`.

```toml
[build]
  command = "marko-run build"
  publish = "dist/public"
  edge_functions = "dist"
```

## Platform info

The route handler `platform` argument is the Netlify [`Context`](https://docs.netlify.com/build/functions/api/#context-object) the function receives:

```ts
import type { NetlifyFunctionsPlatformInfo } from "@marko/run-adapter-netlify";

export const GET: MarkoRun.Handler = (context) => {
  const { geo, cookies } = context.platform as NetlifyFunctionsPlatformInfo;
  cookies.set("visited", "yes");
  return new Response(`Hello from ${geo.city ?? "somewhere"}!`);
};
```

`marko-run dev` doesn't run on Netlify, so it passes a local stand-in: `cookies`, `ip`, `url`, `requestId`, `json`, `log` and `waitUntil` work as they do on Netlify, details only Netlify knows (`geo`, `site`, `deploy`, `account`) are empty, `next()` hands the request on to the dev server (static files were already served, so that's its 404 handling), and `rewrite()` rejects. `marko-run preview` runs the build on Netlify's own dev server, with its full `Context`.

## A function entry of your own

Give Marko Run an entry of your own to run code around the router, and it becomes the function. It exports what Netlify invokes, a `(request, context)` function, and passes the router a `platform`:

```ts
// src/index.ts
import { fetch } from "@marko/run/router";
import type { Context } from "@netlify/functions";

export default async (request: Request, context: Context) =>
  (await fetch(request, context)) ?? new Response(null, { status: 404 });
```

```sh
marko-run dev src/index.ts
marko-run build src/index.ts
marko-run preview src/index.ts
```

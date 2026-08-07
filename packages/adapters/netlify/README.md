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

The default edge function declares the app's routes as its [path declarations](https://docs.netlify.com/edge-functions/declarations/), so route paths may contain dots (`/reports/report.2024.pdf`, `/@jane.doe`) and every other path — published files included — stays with Netlify's own static handling. The build's assets directory is excluded from the declarations so a catch-all route cannot claim it.

Two consequences are worth knowing. A catch-all route claims published files that fall under it; a handler can `throw null` to hand such a path back to Netlify. And because unmatched paths never reach the app, Netlify answers them rather than the app's `+404` page — publish a `404.html` to customize that.

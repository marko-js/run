<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-darkmode.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-netlify
	<br/>
</h1>

Preview and deploy [@marko/run](../serve/README.md) apps to Netlify Functions/Edge Functions

## Intallation

```sh
npm install @marko/run-adapter-netlify
```

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

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

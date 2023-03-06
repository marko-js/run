<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-darkmode.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-static
	<br/>
</h1>

Adapter for [@marko/run](../serve/README.md) to produce staticly served files

## Intallation

```
npm install @marko/run-adapter-static
```

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

```
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import staticAdapter from "@marko/run-adapter-static";

export default defineConfig({
  plugins: [
    marko({
      adapter: staticAdapter()
    })
  ]
});
```




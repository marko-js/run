<h1 align="center">
  <!-- Logo -->
  <img src="https://user-images.githubusercontent.com/4985201/115444712-ca550500-a1c9-11eb-9897-238ece59129c.png" height="118"/>
  <br/>
  @marko/run-adapter-static
	<br/>

  <!-- Language -->
  <a href="http://typescriptlang.org">
    <img src="https://img.shields.io/badge/%3C%2F%3E-typescript-blue.svg" alt="TypeScript"/>
  </a>
  <!-- Format -->
  <a href="https://github.com/prettier/prettier">
    <img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="Styled with prettier"/>
  </a>
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




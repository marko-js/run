<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-static
	<br/>
</h1>

Preview and deploy [@marko/run](../serve/README.md) apps as static files

## Installation

```sh
npm install @marko/run-adapter-static
```

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import staticAdapter from "@marko/run-adapter-static";

export default defineConfig({
  plugins: [
    marko({
      adapter: staticAdapter(),
    }),
  ],
});
```

## Output

Each crawled page is written to an HTML file named after its path, following the [`trailingSlashes`](https://markojs.com/docs/marko-run/vite-plugin#trailingslashes) option of the `@marko/run` Vite plugin:

| `trailingSlashes`           | `/about` is written to                                   |
| --------------------------- | -------------------------------------------------------- |
| `RedirectWithout` (default) | `about.html`                                             |
| `RedirectWith`              | `about/index.html`, with a redirect page at `about.html` |
| `RewriteWithout`            | `about.html`                                             |
| `RewriteWith`               | `about/index.html`                                       |

Hosts that serve `/about` from `about/index.html` but do not map extensionless paths to `.html` files call for `RedirectWith` or `RewriteWith`.

# Getting Started with Marko Run

This guide gets you from nothing to a running Marko Run app.

## Prerequisites

- **Node.js** (a current LTS version is recommended).
- A package manager — `npm`, `pnpm`, or `yarn`. Examples below use `npm`.

## Option 1: Scaffold a new project (recommended)

The fastest way to start is the Marko project creator, which can generate a Marko
Run app from a template:

```bash
npm init marko -- -t basic
```

Then install and start:

```bash
cd my-app
npm install
npm run dev
```

Open the URL printed in your terminal (the dev server listens on
`http://localhost:3000` by default).

> Marko Run is currently in **beta** — APIs may shift between releases. The CLI
> ships with sensible defaults (a built-in Vite config and the Node adapter), so
> "zero config" really is zero config.

## Option 2: Add Marko Run to a project manually

Install the framework, the Marko compiler/runtime, Vite, and an adapter. The Node
adapter is a good default:

```bash
npm install @marko/run marko
npm install -D @marko/run-adapter-node vite
```

### Configure Vite

Create `vite.config.js` (or `.ts`) and add the Marko Run plugin:

```js
import { defineConfig } from "vite";
import marko from "@marko/run/vite";

export default defineConfig({
  plugins: [marko()],
});
```

To target a specific platform, pass an adapter to the plugin:

```js
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import adapter from "@marko/run-adapter-node";

export default defineConfig({
  plugins: [marko({ adapter: adapter() })],
});
```

### Add scripts

In `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "marko-run",
    "build": "marko-run build",
    "preview": "marko-run preview"
  }
}
```

- `dev` — start the dev server with hot reloading.
- `build` — produce a production build.
- `preview` — serve the production build locally.

## Your first route

Create `src/routes/+page.marko`:

```marko
<h1>Hello Marko Run!</h1>
```

Start the dev server:

```bash
npm run dev
```

Visit `/` and you should see your page. Because routing is file-based, the path
of the file under `src/routes` determines the URL. For example,
`src/routes/about/+page.marko` becomes `/about`.

## Add a layout

A layout wraps the pages beneath it. Create `src/routes/+layout.marko`:

```marko
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My App</title>
  </head>
  <body>
    <${input.renderBody}/>
  </body>
</html>
```

The `<${input.renderBody}/>` is where the page (and any nested layouts) render.

## TypeScript

If a `tsconfig.json` exists in your project root, the Vite plugin generates a
route-aware type file at **`.marko-run/routes.d.ts`** whenever you build or run dev.
Include it in your `tsconfig.json` so the types reach your handlers and pages:

```json
{
  "include": ["src/**/*", "vite.config.ts", ".marko-run/*"]
}
```

These generated types give every route file an injected **`Run`** namespace, typed
to that file's route(s): `Run.GET(...)`, `Run.Context`, `Run.href(...)`, etc. (An
older global `MarkoRun` namespace still works but is deprecated in favor of `Run`.)
You never edit the generated file — it regenerates from your route tree. Pairing
this with the [Marko VS Code extension](https://marketplace.visualstudio.com/items?itemName=Marko-JS.marko-vscode)
gives the best editor experience.

## Next steps

- [Project Structure](./project-structure.md) — what each file and folder does.
- [File-based Routing](./file-based-routing.md) — the routing rules in detail.

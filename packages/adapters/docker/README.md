<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-docker
	<br/>
</h1>

Preview and deploy [@marko/run](../../run/README.md) apps as a Docker container

## Installation

```sh
npm install @marko/run-adapter-docker
```

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import dockerAdapter from "@marko/run-adapter-docker";

export default defineConfig({
  plugins: [
    marko({
      adapter: dockerAdapter(),
    }),
  ],
});
```

Running `marko-run build` produces a self-contained Node.js server (`dist/index.mjs`) that serves your app and its static assets, and generates a `Dockerfile` and `.dockerignore` in your project root.

Because the server is bundled, the image doesn't need a `node_modules` install:

```sh
marko-run build
docker build -t my-app .
docker run -p 3000:3000 my-app
```

The container listens on the `PORT` environment variable (defaulting to `3000`).

> The generated `Dockerfile`/`.dockerignore` are only written if they don't already exist, so you can safely customize them — delete a file to have it regenerated.

## Configuration

```ts
dockerAdapter({
  // Base image to build from (default: "node:20-alpine")
  baseImage: "node:22-slim",
});
```

## Deploying

The resulting image runs anywhere containers do — [Fly.io](https://fly.io), [Railway](https://railway.app), [Render](https://render.com), Google Cloud Run, AWS ECS/Fargate, Kubernetes, etc.

## Platform info

Route handlers receive the underlying Node request and response objects via the exported `DockerPlatformInfo` type.

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

That's all the setup required — Marko Run automatically discovers an installed adapter and uses it, so you **don't** need to register it in your Vite config. See [Configuration](#configuration) to change the base image.

`marko-run build` produces a self-contained Node.js server (`dist/index.mjs`) that serves your app and its static assets, and generates a `Dockerfile` and `.dockerignore` in your project root. The container listens on the `PORT` environment variable (defaulting to `3000`).

> The generated `Dockerfile`/`.dockerignore` are only written if they don't already exist, so you can safely customize them — delete a file to have it regenerated.

## Deploying

Because the server is bundled, the image doesn't need a `node_modules` install — build it and run it:

```sh
npm run build
docker build -t my-app .
docker run -p 3000:3000 my-app
```

The resulting image runs anywhere containers do — [Fly.io](https://fly.io), [Railway](https://railway.app), [Render](https://render.com), Google Cloud Run, AWS ECS/Fargate, Kubernetes, etc. Push it to a registry and deploy it with your platform of choice.

## Configuration

Marko Run uses this adapter automatically, but you can register it in your Vite config (eg. `vite.config.js`) to change the base image:

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import dockerAdapter from "@marko/run-adapter-docker";

export default defineConfig({
  plugins: [
    marko({
      adapter: dockerAdapter({
        // Base image to build from (default: "node:20-alpine")
        baseImage: "node:22-slim",
      }),
    }),
  ],
});
```

## Platform info

Route handlers receive the underlying Node request and response objects via the exported `DockerPlatformInfo` type.

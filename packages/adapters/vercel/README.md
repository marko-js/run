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

Preview and deploy [@marko/run](../../run/README.md) apps to [Vercel Functions](https://vercel.com/docs/functions)

## Installation

```sh
npm install @marko/run-adapter-vercel
```

That's all the setup required — Marko Run automatically discovers an installed adapter and uses it, so you **don't** need to register it in your Vite config. Builds target Vercel's Node.js runtime with response streaming enabled, so pages flush to the browser as they render. (The Edge runtime is not supported — Vercel has [deprecated Edge Functions](https://vercel.com/docs/functions/runtimes/edge/edge-functions) in favor of the Node.js runtime.)

## Previewing locally

After building, `marko-run preview` serves the generated `.vercel/output` locally — static assets are served from disk and everything else is handled by the built function, mirroring how Vercel routes requests in production:

```sh
npm run build
npm run preview
```

This runs entirely on your machine: no Vercel account, project link, or Vercel CLI is required.

## Deploying

`marko-run build` produces a [Vercel Build Output API](https://vercel.com/docs/build-output-api/v3) directory at `.vercel/output`, which Vercel deploys directly.

The simplest option is Vercel's Git integration: set your project's build command to `marko-run build` and Vercel picks up `.vercel/output` automatically — no output directory configuration required.

To deploy from your machine with the [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`), build and upload the prebuilt output:

```sh
npm run build
npx vercel deploy --prebuilt
```

Add `--prod` to deploy to production.

## Configuration

Marko Run uses this adapter automatically, but you can also register it explicitly in your Vite config (eg. `vite.config.js`):

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

### Options

The options configure the generated [Vercel Function](https://vercel.com/docs/build-output-api/primitives#serverless-function-configuration). Since the build output is prebuilt, `functions` settings in `vercel.json` don't apply — set them here instead.

```ts
vercelAdapter({
  runtime: "nodejs24.x", // default: the build's Node.js major, rounded down to an LTS
  regions: ["iad1"], // default: the project's function region
  memory: 1024, // MB
  maxDuration: 60, // seconds, or "max"
});
```

## A function entry of your own

By default the Vercel Function is the adapter's own entry, which hands each request to Marko Run's router. To run code around the router (wrapping requests, adding to `platform`, handling some paths yourself), give Marko Run an entry of your own, and it becomes the function:

```sh
marko-run dev src/index.ts
marko-run build src/index.ts
marko-run preview src/index.ts
```

The entry only exports what Vercel invokes, an object with a `fetch(request)` method, and doesn't start a server: `marko-run dev` calls it the same way, through Vite, so edits apply without a restart. Vercel calls `fetch` with the web `Request` alone, so pass the router a `platform` yourself; `createPlatform` gives the one the adapter's own entry uses:

```ts
// src/index.ts
import { createPlatform } from "@marko/run-adapter-vercel/runtime";
import { fetch } from "@marko/run/router";

export default {
  async fetch(request: Request) {
    const response = await fetch(request, createPlatform());
    return response || new Response("Not Found", { status: 404 });
  },
};
```

## Caching

Hashed client assets under `/assets/` are cached by browsers and Vercel's CDN for a year, and other files in `public/` are cached by the CDN until the next deployment. Dynamic routes are not cached unless a response asks for it.

### Caching responses on the CDN

Vercel's CDN caches a function response that sends a `Cache-Control` header with `s-maxage`. Set it from a `+handler` or `+middleware` after the page renders:

```ts
// src/routes/blog/$slug/+handler.ts
export const GET: MarkoRun.Handler = async (context, next) => {
  const response = await next();
  response.headers.set(
    "cache-control",
    "public, s-maxage=60, stale-while-revalidate=600",
  );
  return response;
};
```

With `stale-while-revalidate`, visitors keep getting the cached page while Vercel re-renders it in the background. Some details:

- Only `GET` and `HEAD` requests without an `Authorization` header are cached, and only responses with status `200`, `301`, `302`, `307`, `308`, `404` or `410` that don't set a cookie.
- Vercel strips `s-maxage` and `stale-while-revalidate` before the response reaches the browser. Use `CDN-Cache-Control` to cache on downstream CDNs too, or `Vercel-CDN-Cache-Control` to cache on Vercel's CDN alone, separately from the browser's `Cache-Control`.
- The cache is per region and best effort: rarely requested pages can be evicted early. Each deployment starts with an empty cache.
- Add `Vary` for request headers that change the page, such as `Accept-Language`. A response that varies on `Cookie` is never cached.
- The `x-vercel-cache` response header (`HIT`, `MISS`, `STALE`, …) shows whether a response came from the cache.

See [Vercel's CDN cache docs](https://vercel.com/docs/caching/cdn-cache) for the full rules.

### Purging by tag

To refresh cached pages when their content changes rather than on a timer, tag the response with `Vercel-Cache-Tag` (a comma-separated list) and invalidate the tag later, with [`invalidateByTag`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package) from `@vercel/functions`, `vercel cache invalidate --tag`, or the dashboard:

```ts
// src/routes/products/$id/+handler.ts
export const GET: MarkoRun.Handler = async (context, next) => {
  const response = await next();
  response.headers.set("cache-control", "public, s-maxage=86400");
  response.headers.set(
    "vercel-cache-tag",
    `product-${context.params.id},products`,
  );
  return response;
};
```

```ts
// src/routes/api/products/$id/+handler.ts
import { invalidateByTag } from "@vercel/functions";

export const POST: MarkoRun.Handler = async (context) => {
  await saveProduct(context.params.id, await context.request.json());
  await invalidateByTag(`product-${context.params.id}`);
  return new Response(null, { status: 204 });
};
```

Invalidating serves the stale page once while it re-renders in the background. See [purging Vercel's CDN cache](https://vercel.com/docs/caching/cdn-cache/purge) for limits and the alternatives.

## Platform info

Vercel passes a function nothing besides the request, so the route handler `platform` argument holds what the adapter adds: `waitUntil`. Anything else Vercel provides per request comes from the request itself, such as [geolocation and IP headers](https://vercel.com/docs/headers/request-headers), or from [`@vercel/functions`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).

### `waitUntil`

A function stops once its response is sent, so work still pending at that point is dropped. `waitUntil(promise)` keeps it running until `promise` settles, for work the response shouldn't wait on, such as analytics, logging or warming a cache:

```ts
import type { VercelPlatformInfo } from "@marko/run-adapter-vercel";

export const POST: MarkoRun.Handler = async (context, next) => {
  const { waitUntil } = context.platform as VercelPlatformInfo;
  waitUntil(recordEvent("signup", context.url));
  return next();
};
```

In `marko-run dev` and `marko-run preview` the promise simply runs in the background, and a rejection is logged. Code outside a route handler can import `waitUntil` from `@marko/run-adapter-vercel/runtime`.

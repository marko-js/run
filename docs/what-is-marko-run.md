# What is Marko Run

Marko Run is the application framework for [Marko](https://markojs.com). Marko by
itself is a UI language — it gives you components, templates, and rendering. Marko
Run wraps those components in everything you need to ship a real server-rendered
application: routing, request/response handling, middleware, and deployment.

If you have used Next.js, SvelteKit, Remix, or SolidStart, Marko Run fills the
same role for Marko.

## What it gives you

- **File-based routing.** Your URL structure mirrors the folder structure under
  `src/routes`. There is no central route configuration file to maintain.
- **Server-side rendering (SSR) with streaming.** Pages render on the server and
  stream to the browser, with Marko handling progressive/async rendering.
- **Request handlers (API routes).** Any route can export functions for HTTP
  methods (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`) to build
  JSON APIs, form handlers, or webhooks — no separate server framework required.
- **Built-in validation.** Handlers can declare validators for params, query
  strings, and request bodies using any [Standard Schema](https://standardschema.dev)
  library (Zod, Valibot, ArkType). See [Validation](./validation.md).
- **First-class data loading.** Middleware and handlers contribute data via
  `next(data)`, which is merged and exposed to pages as `$global.data` — fully
  typed. See [Data Loading](./data-loading.md).
- **Middleware and layouts.** Run code before a route handles a request, and wrap
  pages in shared UI that nests with your folder structure.
- **TypeScript support.** Marko Run generates types for your routes, params, and
  context (the injected `Run` namespace) and a type-safe `Run.href` URL builder, so
  handlers, pages, and links are checked against your actual route tree.
- **Deploy anywhere through adapters.** The same application can target a Node
  server, a static site, or serverless/edge platforms by swapping the adapter
  (official adapters: **node**, **static**, **netlify**).

> **Status:** Marko Run is currently in **beta**. It's already capable, but APIs
> can change between releases — pin versions and check changelogs when upgrading.

## How it fits together

```
┌─────────────────────────────────────────────┐
│  Your app                                     │
│                                               │
│   src/routes/**     ← pages, layouts,         │
│                       handlers, middleware    │
│   Marko components  ← UI (.marko files)       │
└───────────────┬───────────────────────────────┘
                │
        @marko/run (Vite plugin)
        - scans src/routes
        - builds the router
        - wires up SSR
                │
          ┌─────┴──────┐
          │            │
        Vite        Adapter
     (dev/build)   (Node, static,
                    serverless, …)
```

- **Marko** renders your components to HTML.
- **`@marko/run`** is a Vite plugin that discovers your routes, generates a
  router, and connects it to Marko's SSR.
- **Vite** powers the dev server (with hot reloading) and the production build.
- **An adapter** takes the build output and produces something deployable for a
  specific target.

## When to use Marko Run

Use Marko Run when you are building an application (not just a single embedded
widget) with Marko and you want routing, server rendering, and a clear path to
deployment. If you only need a few Marko components inside an existing app, you
can use Marko on its own without Marko Run.

## Next steps

- [Getting Started](./getting-started.md) to scaffold a project.
- [File-based Routing](./file-based-routing.md) to understand how routes work.

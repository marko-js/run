# Marko Run Documentation

Marko Run is the application framework for [Marko](https://markojs.com). It adds
file-based routing, server-side rendering, middleware, and request handlers on
top of Marko and [Vite](https://vitejs.dev), and lets you deploy the same app to
many different platforms through adapters.

## Table of contents

1. [What is Marko Run](./what-is-marko-run.md) — the problem it solves and how it
   fits together with Marko and Vite.
2. [Getting Started](./getting-started.md) — create a project, install
   dependencies, and run your first route.
3. [Project Structure](./project-structure.md) — the files and folders in a Marko
   Run app and what each one is for.
4. [File-based Routing](./file-based-routing.md) — how the `src/routes` directory
   becomes your URL structure, including dynamic and catch-all routes, layouts,
   handlers, middleware, and meta.
5. [Useful Patterns](./useful-patterns.md) — recipes for common things:
   authentication, redirects, cookies, API routes, error pages, and more.
6. [Data Loading](./data-loading.md) — fetching data on the server and getting it
   into your pages.
7. [Validation](./validation.md) — validating route params, query strings, and
   request bodies.

Plus:

- [Source-Review Notes](./source-review-notes.md) — how these docs were checked
  against the `marko-js/run` source, every correction made, and the places that
  needed more emphasis (read this to see what changed and why).

## Conventions used in these docs

- File paths are written relative to the project root (for example,
  `src/routes/+page.marko`).
- Code samples use TypeScript where types are relevant, but everything works in
  plain JavaScript too — just drop the type annotations.
- "Special files" are the framework-recognized files in the routes directory,
  always prefixed with a `+` (such as `+page.marko` and `+handler.ts`).
- `Run` refers to the per-route-file namespace the Vite plugin injects into every
  routable file (used as `Run.GET(...)`, `Run.Context`, `Run.href(...)`). You don't
  import it. An older global `MarkoRun` namespace still works but is deprecated.

> Marko Run is in **beta** — treat version-specific details here as a snapshot and
> confirm against your installed version's generated types and changelog.

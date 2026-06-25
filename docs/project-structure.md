# Project Structure

A typical Marko Run application looks like this:

```
my-app/
├── src/
│   └── routes/                 # file-based routing lives here
│       ├── +layout.marko       # root layout (the HTML shell)
│       ├── +page.marko         # the "/" page
│       ├── +middleware.ts      # runs for every request under this folder
│       ├── about/
│       │   └── +page.marko     # "/about"
│       └── products/
│           ├── +page.marko     # "/products"
│           └── $id/
│               ├── +page.marko     # "/products/:id"
│               └── +handler.ts      # data/logic for "/products/:id"
├── public/                     # static assets served as-is
├── components/                 # shared Marko components (optional)
├── vite.config.js
├── tsconfig.json
└── package.json
```

## The `src/routes` directory

This is the heart of a Marko Run app. The folder structure under `src/routes`
**is** your URL structure. Folders create path segments, and special files
(always prefixed with `+`) tell the framework what each route does. See
[File-based Routing](./file-based-routing.md) for the full rules.

### Special files

All framework-recognized files start with a `+`. This prefix is what separates
them from ordinary components, so you can freely colocate non-route files in the
same folder.

| File | Purpose |
| --- | --- |
| `+page.marko` | The page rendered for this route's URL. |
| `+layout.marko` | UI that wraps the page and any nested routes. Layouts nest with the folder structure. |
| `+handler.{js,ts}` | Request handling for HTTP methods (`GET`, `POST`, …). Used for data loading and API routes. |
| `+middleware.{js,ts}` | Code that runs before handlers/pages for this folder and everything nested under it. |
| `+meta.{js,ts,json}` | Static metadata attached to the route, available on the context. |
| `+404.marko` | Page rendered (status `404`) when no route matches. **Root only.** |
| `+500.marko` | Page rendered (status `500`) when a request throws. **Root only.** |

> `+404.marko` and `+500.marko` may only live at the **top level** of the routes
> directory, and they respond only to requests whose `Accept` header includes
> `text/html`. See [File-based Routing](./file-based-routing.md#special-pages-404-and-500).

Note on folder names: a folder whose name starts with `_` is **pathless** (it
organizes files or scopes a layout/middleware without adding a URL segment), `$`
marks a **dynamic** param, and `$$` a **catch-all**. See
[File-based Routing](./file-based-routing.md#path-segment-types).

### Colocation

Because special files use the `+` prefix, you can keep route-specific components,
styles, and helpers right next to the route that uses them:

```
products/
├── +page.marko
├── +handler.ts
├── product-card.marko   # a regular component, not a route
└── utils.ts             # a regular module, not a route
```

Only `+`-prefixed files participate in routing; everything else is just a normal
module you can import.

## The `public` directory

Files in `public/` are served at the root path without processing. A file at
`public/favicon.ico` is available at `/favicon.ico`. Use this for static assets
that don't need to go through the build (favicons, `robots.txt`, images you
reference by URL, etc.).

## `vite.config.js`

Vite configuration, including the Marko Run plugin and your chosen adapter. See
[Getting Started](./getting-started.md#configure-vite).

## Generated files (`.marko-run/`)

Marko Run generates a route-aware TypeScript declaration file at
`.marko-run/routes.d.ts` on every build and dev run (when a `tsconfig.json` is
present). Don't edit it by hand — it regenerates from your route tree.

> **Corrected after source review:** add `.marko-run/*` to your `tsconfig.json`
> `include` so the generated types are picked up. Don't rely on git-ignoring it —
> the project's own examples (e.g. `examples/node-express`) commit the generated
> `routes.d.ts`, and the authoritative guidance is to include it in `tsconfig`
> rather than to ignore it.

## Configuring the routes directory

The routes directory defaults to `./src/routes`. Override it via the Vite plugin's
`routesDir` option (relative to the Vite config), e.g.
`marko({ routesDir: "src/pages" })`.

## Next steps

- [File-based Routing](./file-based-routing.md) — the rules that turn this
  structure into routes.

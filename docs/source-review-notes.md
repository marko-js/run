# Source-Review Notes

These docs were written in two passes:

1. **From knowledge** — the seven topic docs were drafted from general knowledge of
   Marko Run, without reading this repository.
2. **Against the source** — the drafts were then compared to the actual
   `marko-js/run` code on this branch (`README`, `packages/run/src/runtime/types.ts`,
   the Vite codegen, and the test fixtures under
   `packages/run/src/__tests__/fixtures`). This file records the differences and
   **where the docs needed correction or more emphasis** as a result.

A notable wrinkle: this docs branch sits on top of the `validation-and-data-loading`
feature work, so the tree contains a **first-class validation and data-loading
API that the README doesn't fully document yet**. Several "needs more emphasis"
items below come from that gap.

## Corrections (my draft was wrong)

| # | Topic | My draft said | The source says | Fixed in |
| --- | --- | --- | --- | --- |
| 1 | **Pathless routes** | Use parentheses `(group)` | Pathless = **`_` prefix** (`_app`). Parentheses are for **flat-route grouping** only. | `file-based-routing.md`, `useful-patterns.md`, `data-loading.md`, `project-structure.md` |
| 2 | **TS context typing** | `declare global { namespace MarkoRun { interface Context } }` | **Module augmentation**: `declare module "@marko/run" { interface Platform {} }`. Per-file namespace is **`Run`**; `MarkoRun` is **deprecated**. | `data-loading.md`, `getting-started.md` |
| 3 | **404/500 pages** | Could imply nesting | **Root-level only**; respond only when `Accept` includes `text/html`; `+500` receives `input.error`. | `file-based-routing.md`, `useful-patterns.md`, `project-structure.md` |
| 4 | **Generated types** | Add `.marko-run/` to `.gitignore` | Generated at `.marko-run/routes.d.ts`; add `.marko-run/*` to tsconfig `include` (examples even commit it). | `getting-started.md`, `project-structure.md` |
| 5 | **Create command** | `npm init marko -- --template basic` | `npm init marko -- -t basic` | `getting-started.md` |
| 6 | **Redirects** | Hand-built `Response` only | Idiomatic helpers `ctx.redirect()` / `ctx.back()` exist. | `useful-patterns.md` |

## Additions / more emphasis (real features my draft under-weighted or missed)

| # | Feature | Why it matters | Emphasized in |
| --- | --- | --- | --- |
| 7 | **First-class validation** — `Run.POST({ json/form/params/search: schema }, handler)`, Standard Schema (Zod/Valibot/ArkType), `await ctx.body` → `[value, issues]`, multipart limits/`onFile`. | The README presents validation as DIY; the code has it built in. This is the headline of the Validation doc now. | `validation.md` (rewritten) |
| 8 | **First-class data loading** — `next(data)` merges into `context.data` / `$global.data`, across middleware + handler; `POST` + `next(data)` renders the page. | The intended data path; my draft only had the ad-hoc "attach to context" version. | `data-loading.md` (rewritten) |
| 9 | **Flat routes** — periods for segments, commas for multiple paths, `()` groups, optional segments, backtick escaping. | An entire routing feature I omitted. | `file-based-routing.md` |
| 10 | **Injected `Run` namespace** — callable per-file (`Run.GET`, `Run.ALL`, `Run.href`), no import. | Changes how every handler/middleware is written. | all server-side docs |
| 11 | **Type-safe `Run.href`** | Compile-time-checked links tied to the route tree. | `useful-patterns.md` |
| 12 | **Full context shape + helpers** — `route`, `method`, `search`, `body`, `data`, `serializedGlobals`, `parent`, and methods `fetch`/`render`/`redirect`/`back`. | My draft listed ~5 properties and no methods. | `file-based-routing.md` |
| 13 | **`Run.NotHandled` / `Run.NotMatched`** return signals. | Needed for raw-response and "fall through to 404" cases. | `file-based-routing.md` |
| 14 | **Embedding API** — `@marko/run/router` `fetch`/`match`/`invoke`. | Mount Marko Run inside Express/etc. | `useful-patterns.md` |
| 15 | **Verb-specific meta overrides** | `+meta` objects can override per HTTP method. | `file-based-routing.md` |
| 16 | **Layout slot is version-specific** — `input.renderBody` (class API / Marko 5) vs `content` (tags API / Marko 6). | Avoids a confusing layout error. | `file-based-routing.md`, noted in `getting-started.md` |
| 17 | **`routesDir` option** | Routes dir is configurable. | `project-structure.md`, `file-based-routing.md` |
| 18 | **Beta status** | Sets upgrade expectations. | `what-is-marko-run.md`, `getting-started.md` |

## Confirmations (my draft was right — hedges removed)

- `context` **is** `$global` in pages. ✅
- Scripts `marko-run` / `marko-run build` / `marko-run preview` match the
  `examples/zero-config` package.json. ✅
- A handler may **return or throw** a `Response`. ✅ (Validation doc no longer
  hedges.)
- `+`-prefixed special files + colocation of ordinary files. ✅
- `$` / `$$` for dynamic / catch-all, with bare `$` / `$$` matching without
  capturing. ✅
- Adapters: **node, static, netlify**. ✅

## Suggested follow-ups for the maintainers

- The package **README's "Beta Roadmap"** still lists items (e.g. redirect
  component) and its data-loading guidance predates the first-class
  validation/data API now in the tree — the README is the best place to surface
  items 7, 8, and 11 to a wider audience.
- Consider documenting the exact **validation-failure semantics** for `params` and
  `search` (the fixtures exercise transforms and the `body` tuple, but failure
  behavior for `params`/`search` schemas is worth an explicit example).

# @marko/run Monorepo

`@marko/run` is the Marko application framework: file-based routing (`src/routes/**` with `+page.marko`, `+layout.marko`, `+handler`, `+middleware`), a Vite plugin, and deployment adapters. npm workspaces; primary development happens in `packages/run`, adapters live in `packages/adapters/*`.

## Commands

```sh
npm test                 # mocha suite (tsx loader)
npm run test:update      # regenerate test expectations (review the diff!)
npm run build            # all packages -> dist/
npm run lint             # eslint + prettier + cspell
npm run format           # eslint --fix + prettier --write
npm run change           # add a changeset (required for user-facing changes)
```

## Agent feedback

Anything actionable but out of scope for the current task — a suspected bug, cleanup, a perf/size win, tooling friction, or code that was confusing — must be recorded in [`agent-feedback/`](agent-feedback/README.md) before finishing. Don't silently drop it, and don't fix it inside an unrelated diff.

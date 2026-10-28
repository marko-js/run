# Patch router in real browsers

Run `pnpm exec playwright install --with-deps chromium firefox webkit`,
`node node_modules/playwright-safari26/cli.js install webkit`, then
`pnpm run test:browser` (`pnpm exec tsc -p tests/browser` type-checks the
suite). CI's `browser` job (`.github/workflows/ci.yml`) runs these through
`@ci:test:browser` on Ubuntu 24.04 with Node 26, keeping failure traces and
the HTML report.
`MARKO_TEST_WORKERS` controls the worker count (default two).

Playwright 1.64.1 supplies Chromium, Firefox and WebKit. The `safari26` project
uses WebKit revision 2336 from the separately locked Playwright core 1.62.1.
That engine exposes `navigation` but lacks `NavigationPrecommitController`;
the capability test fails if this changes. It stands in for that Safari 26
capability set; it is not a test against shipping Safari or macOS.
Every engine also runs with `window.navigation` removed. The jsdom suite stays
in place for the base router.

The server and patch adapter derive from the Navigation API probe harness.
The adapter supplies the router's patch tuple and streams HTML frames without
compiling Marko. Requests, commits, cancellation and response completion are
observable, and server gates hold the first flush or the rest of the response.
Tests wait for those events, never timed sleeps; an app's `navigate` listener
runs before the router's or after it, and tests that involve one run both. This isolates router/browser
behavior; Marko's patch application and flush ordering have their own tests.

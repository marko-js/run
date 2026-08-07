import assert from "assert";

import type { Step, StepContext } from "../../main.test";

// A dotted catch-all path used to never reach the edge function -- its config
// only matched dot-free paths -- so it 404'd from the static CDN even though
// the router matches it. Loading it here is the regression: in preview the
// request goes through the built edge function.
export const path = "/reports/report.2024.pdf";

function get({ page }: StepContext, to: string) {
  return page.fetch(new URL(to, page.url()).href);
}

// The catch-all also covers this path, but a published static file wins --
// the entry offers the request to the platform before the router, matching
// how the functions adapter's `preferStatic` and the dev server behave.
async function staticFileWins(ctx: StepContext) {
  const res = await get(ctx, "/reports/pinned.txt");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^static file/);
}

async function dottedPathRoutes(ctx: StepContext) {
  const res = await get(ctx, "/reports/q1.2026.csv");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /report=q1\.2026\.csv/);
}

async function unmatchedPathIs404(ctx: StepContext) {
  assert.equal((await get(ctx, "/nothing.here")).status, 404);
}

export const steps: Step[] = [
  (ctx) => staticFileWins(ctx),
  (ctx) => dottedPathRoutes(ctx),
  (ctx) => unmatchedPathIs404(ctx),
];

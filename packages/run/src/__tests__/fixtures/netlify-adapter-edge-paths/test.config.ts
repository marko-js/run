import assert from "assert";

import type { Step, StepContext } from "../../main.test";

// A dotted catch-all path used to never reach the edge function -- its config
// only matched dot-free paths -- so it 404'd from the static CDN even though
// the router matches it. Loading it here is the regression: in preview the
// request goes through the built edge function.
export const path = "/reports/report.2024.pdf";

function request({ page }: StepContext, to: string, init?: RequestInit) {
  return page.fetch(new URL(to, page.url()).href, init);
}

// The catch-all also covers this path, but a published static file wins --
// the entry offers the request to the platform before the router, matching
// how the functions adapter's `preferStatic` and the dev server behave. The
// content type tells the two apart: the route would render html.
async function staticFileWins(ctx: StepContext) {
  const res = await request(ctx, "/reports/pinned.txt");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type")!, /text\/plain/);
  assert.match(await res.text(), /^static file/);
}

// HEAD takes the same static-first path as GET.
async function staticFileWinsForHead(ctx: StepContext) {
  const res = await request(ctx, "/reports/pinned.txt", { method: "HEAD" });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type")!, /text\/plain/);
}

// A published file the path does not advertise -- no extension to go by -- is
// still served: no route claims it, so the platform is asked before the
// router's 404 is answered.
async function extensionlessStaticFileServes(ctx: StepContext) {
  const res = await request(ctx, "/notes");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^extensionless file/);
}

async function dottedPathRoutes(ctx: StepContext) {
  const res = await request(ctx, "/reports/q1.2026.csv");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /report=q1\.2026\.csv/);
}

// Methods that can carry a body skip the static check and go straight to the
// router, so the handler answers even where a static file sits -- offering the
// request to the platform first would consume its body. Only preview drives
// the edge function; the dev server answers `public/` files for every method,
// so the collision cannot be observed there.
async function postSkipsTheStaticFile(ctx: StepContext) {
  const res = await request(ctx, "/reports/pinned.txt", { method: "POST" });
  assert.equal(res.status, 200);
  assert.equal(
    await res.text(),
    process.env.NODE_ENV === "production" ? "posted pinned.txt" : "static file\n",
  );
}

// The app's own 404 page renders for an unmatched dotted path, which the
// static CDN answered on its own before.
async function unmatchedPathRendersThe404Page(ctx: StepContext) {
  const res = await request(ctx, "/nothing.here", {
    headers: { accept: "text/html" },
  });
  assert.equal(res.status, 404);
  assert.match(await res.text(), /app 404 page/);
}

export const steps: Step[] = [
  (ctx) => staticFileWins(ctx),
  (ctx) => staticFileWinsForHead(ctx),
  (ctx) => extensionlessStaticFileServes(ctx),
  (ctx) => dottedPathRoutes(ctx),
  (ctx) => postSkipsTheStaticFile(ctx),
  (ctx) => unmatchedPathRendersThe404Page(ctx),
];

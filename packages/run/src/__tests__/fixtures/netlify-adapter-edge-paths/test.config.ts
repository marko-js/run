import assert from "assert";

import type { Step, StepContext } from "../../main.test";

// A dotted catch-all path never reached the edge function -- its config
// matched only dot-free paths -- so the static CDN 404'd it. Loading it here
// is the regression.
export const path = "/reports/report.2024.pdf";

function request({ page }: StepContext, to: string, init?: RequestInit) {
  return page.fetch(new URL(to, page.url()).href, init);
}

// The catch-all covers this path too, but a published file wins, as it does
// on every other target. The content type tells the two apart.
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

// No extension to go by, so the platform is only asked once the router has
// no answer -- but the file still serves.
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

// Body-carrying methods go straight to the router. Only preview drives the
// edge function; dev answers `public/` files for every method.
async function postSkipsTheStaticFile(ctx: StepContext) {
  const res = await request(ctx, "/reports/pinned.txt", { method: "POST" });
  assert.equal(res.status, 200);
  const body = await res.text();
  if (process.env.NODE_ENV === "production") {
    assert.equal(body, "posted pinned.txt");
  } else {
    assert.match(body, /^static file/);
  }
}

// A handler that declines hands the request back to the platform.
async function declinedPostReachesThePlatform(ctx: StepContext) {
  const res = await request(ctx, "/reports/passthrough.bin", {
    method: "POST",
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^platform answer/);
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
  (ctx) => declinedPostReachesThePlatform(ctx),
  (ctx) => unmatchedPathRendersThe404Page(ctx),
];

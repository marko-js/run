import assert from "assert";

import type { Step, StepContext } from "../../main.test";

// A dotted catch-all path never reached the edge function -- its declaration
// matched only dot-free paths -- so the static CDN 404'd it. Loading it here
// is the regression.
export const path = "/reports/report.2024.pdf";

function request({ page }: StepContext, to: string, init?: RequestInit) {
  return page.fetch(new URL(to, page.url()).href, init);
}

async function dottedPathRoutes(ctx: StepContext) {
  const res = await request(ctx, "/reports/q1.2026.csv");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /report=q1\.2026\.csv/);
}

// No route declares this path, so the edge function never runs for it and
// the platform serves the published file.
async function publishedFileSkipsTheApp(ctx: StepContext) {
  const res = await request(ctx, "/pinned.txt");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type")!, /text\/plain/);
  assert.match(await res.text(), /^static file/);
}

// Nothing about the path says "file", and it still serves.
async function extensionlessPublishedFileServes(ctx: StepContext) {
  const res = await request(ctx, "/notes");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^extensionless file/);
}

// The build's own assets are excluded from the declaration, so they serve
// even when a catch-all route would otherwise claim them.
async function buildAssetsSkipTheApp(ctx: StepContext) {
  const res = await request(ctx, "/assets/pinned.js");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /asset file/);
}

async function postRoutes(ctx: StepContext) {
  const res = await request(ctx, "/reports/q1.2026.csv", { method: "POST" });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "posted q1.2026.csv");
}

// A catch-all route claims published files under it, so declining is how a
// handler hands one of those paths back to the platform.
async function declinedRequestReachesThePlatform(ctx: StepContext) {
  const res = await request(ctx, "/reports/passthrough.bin", {
    method: "POST",
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^platform answer/);
}

export const steps: Step[] = [
  (ctx) => dottedPathRoutes(ctx),
  (ctx) => publishedFileSkipsTheApp(ctx),
  (ctx) => extensionlessPublishedFileServes(ctx),
  (ctx) => buildAssetsSkipTheApp(ctx),
  (ctx) => postRoutes(ctx),
  (ctx) => declinedRequestReachesThePlatform(ctx),
];

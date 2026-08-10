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

// No route answers this path, so the platform's published file does.
async function publishedFileServes(ctx: StepContext) {
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

async function buildAssetServes(ctx: StepContext) {
  const res = await request(ctx, "/assets/pinned.js");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /asset file/);
}

async function postRoutes(ctx: StepContext) {
  const res = await request(ctx, "/reports/q1.2026.csv", { method: "POST" });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "posted q1.2026.csv");
}

// A catch-all route covers this path, so only declining lets the published
// file underneath it answer.
async function declinedRequestReachesThePlatform(ctx: StepContext) {
  const res = await request(ctx, "/reports/passthrough.bin", {
    method: "POST",
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^platform answer/);
}

// Neither the app nor the platform has the path, and the app's own 404 page
// answers rather than the platform's.
async function unmatchedPathRendersThe404Page(ctx: StepContext) {
  const res = await request(ctx, "/nothing.here", {
    headers: { accept: "text/html" },
  });
  assert.equal(res.status, 404);
  assert.match(await res.text(), /app 404 page/);
}

export const steps: Step[] = [
  (ctx) => dottedPathRoutes(ctx),
  (ctx) => publishedFileServes(ctx),
  (ctx) => extensionlessPublishedFileServes(ctx),
  (ctx) => buildAssetServes(ctx),
  (ctx) => postRoutes(ctx),
  (ctx) => declinedRequestReachesThePlatform(ctx),
  (ctx) => unmatchedPathRendersThe404Page(ctx),
];

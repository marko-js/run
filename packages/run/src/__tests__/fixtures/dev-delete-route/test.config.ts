import assert from "assert";
import fs from "fs";
import { join } from "path";

import type { Step, StepContext } from "../../main.test";

// Preview serves a fixed build; deleting route files is a dev-only concern.
export const skip_preview = true;

// Start on the route that will be deleted so its modules are live in the
// dev server's SSR module graph -- the wedge needs a stale importer.
export const path = "/gone";

const pageFile = join(__dirname, "src", "routes", "gone", "+page.marko");
const pageSource = fs.readFileSync(pageFile, "utf-8");
const handlerFile = join(__dirname, "src", "routes", "api", "+handler.ts");
const handlerSource = fs.readFileSync(handlerFile, "utf-8");

async function until(fn: () => Promise<boolean>, label: string) {
  const deadline = Date.now() + 8000;
  do {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

// The body is asserted along with the status: a stale empty module can
// answer 200 too, so only content proves the route really came back.
function serves(page: StepContext["page"], to: string, body?: RegExp) {
  return page.fetch(new URL(to, page.url()).href).then(
    async (res) =>
      body ? res.status === 200 && body.test(await res.text()) : res.status === 200,
    () => false,
  );
}

function answers404(page: StepContext["page"], to: string) {
  return page.fetch(new URL(to, page.url()).href).then(
    (res) => res.status === 404,
    () => false,
  );
}

async function deleteThePage({ page }: StepContext) {
  fs.rmSync(pageFile);
  await until(() => answers404(page, "/gone"), "deleted page to answer 404");
}

async function siblingStillServes({ page }: StepContext) {
  const res = await page.fetch(new URL("/", page.url()).href);
  assert.equal(res.status, 200, "sibling route after deletion");
  assert.match(await res.text(), /home/);
}

async function restoreThePage({ page }: StepContext) {
  fs.writeFileSync(pageFile, pageSource);
  await until(
    () => serves(page, "/gone", /gone page/),
    "restored page to serve its content",
  );
}

async function deleteTheHandler({ page }: StepContext) {
  fs.rmSync(handlerFile);
  await until(() => answers404(page, "/api"), "deleted handler to answer 404");
}

async function restoreTheHandler({ page }: StepContext) {
  fs.writeFileSync(handlerFile, handlerSource);
  await until(
    () => serves(page, "/api", /api ok/),
    "restored handler to serve its response",
  );
}

export const steps: Step[] = [
  (ctx) => deleteThePage(ctx),
  (ctx) => siblingStillServes(ctx),
  (ctx) => restoreThePage(ctx),
  (ctx) => deleteTheHandler(ctx),
  (ctx) => restoreTheHandler(ctx),
];

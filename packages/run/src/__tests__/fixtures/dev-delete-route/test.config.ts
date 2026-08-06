import assert from "assert";
import fs from "fs";
import { join } from "path";

import type { Step, StepContext } from "../../main.test";

// Preview serves a fixed build; deleting route files is a dev-only concern.
export const skip_preview = true;

// Start on the route that will be deleted so its modules are live in the
// dev server's SSR module graph -- the wedge needs a stale importer.
export const path = "/gone";

const routeFile = join(__dirname, "src", "routes", "gone", "+page.marko");
const routeSource = fs.readFileSync(routeFile, "utf-8");

async function until(fn: () => Promise<boolean>, label: string) {
  const deadline = Date.now() + 8000;
  do {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

function fetchStatus(
  page: { fetch(url: string): Promise<Response>; url(): string },
  to: string,
) {
  return page.fetch(new URL(to, page.url()).href).then(
    (res) => res.status,
    () => 0,
  );
}

async function deleteTheRoute({ page }: StepContext) {
    fs.rmSync(routeFile);
    await until(
      async () => (await fetchStatus(page, "/gone")) === 404,
      "deleted route to answer 404",
    );
}

async function siblingStillServes({ page }: StepContext) {
    const res = await page.fetch(new URL("/", page.url()).href);
    assert.equal(res.status, 200, "sibling route after deletion");
    assert.match(await res.text(), /home/);
}

async function restoreTheRoute({ page }: StepContext) {
    fs.writeFileSync(routeFile, routeSource);
    await until(
      async () => (await fetchStatus(page, "/gone")) === 200,
      "restored route to answer 200",
    );
}

export const steps: Step[] = [
  (ctx) => deleteTheRoute(ctx),
  (ctx) => siblingStillServes(ctx),
  (ctx) => restoreTheRoute(ctx),
];

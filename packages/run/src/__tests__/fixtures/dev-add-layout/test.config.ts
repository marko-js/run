import fs from "fs";
import { join } from "path";

import type { Step, StepContext } from "../../main.test";

// Preview serves a fixed build; adding route files is a dev-only concern.
export const skip_preview = true;

const layoutFile = join(__dirname, "src", "routes", "+layout.marko");
const layoutSource = `<div id="layout">
  <\${input.renderBody}/>
</div>
`;

// An aborted run can leave the added layout behind; the fixture must always
// start without one.
fs.rmSync(layoutFile, { force: true });

async function until(fn: () => Promise<boolean>, label: string) {
  const deadline = Date.now() + 8000;
  do {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

// Marko may serialize the attribute unquoted, so match both forms.
const wrapped = /<div id="?layout"?>/;

function bodyOf(page: StepContext["page"]) {
  return page.fetch(new URL("/", page.url()).href).then(
    (res) => (res.status === 200 ? res.text() : ""),
    () => "",
  );
}

async function addTheLayout({ page }: StepContext) {
  fs.writeFileSync(layoutFile, layoutSource);
  await until(async () => {
    const body = await bodyOf(page);
    return wrapped.test(body) && body.includes("page content");
  }, "added layout to wrap the page");
}

async function removeTheLayout({ page }: StepContext) {
  fs.rmSync(layoutFile);
  await until(async () => {
    const body = await bodyOf(page);
    return !wrapped.test(body) && body.includes("page content");
  }, "removed layout to stop wrapping the page");
}

export const steps: Step[] = [
  (ctx) => addTheLayout(ctx),
  (ctx) => removeTheLayout(ctx),
];

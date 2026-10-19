import fs from "fs";
import { join } from "path";

import type { Step, StepContext } from "../../main.test";

// Preview serves a fixed build; restarting after a config edit is a dev-only concern.
export const skip_preview = true;
export const timeout = 30000;

const configFile = join(__dirname, "vite.config.ts");

// An aborted run can leave the edit behind; the fixture must always start clean.
setConfigLabel("one");

async function until(fn: () => Promise<boolean>, label: string) {
  const deadline = Date.now() + 10000;
  do {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

function bodyOf(page: StepContext["page"]) {
  return page.fetch(new URL("/", page.url()).href).then(
    (res) => (res.status === 200 ? res.text() : ""),
    () => "",
  );
}

async function changeConfigLabel({ page }: StepContext, label: string) {
  setConfigLabel(label);
  await until(
    async () => (await bodyOf(page)).includes(`config ${label}`),
    `the page to render with config "${label}"`,
  );
}

function setConfigLabel(label: string) {
  const source = fs.readFileSync(configFile, "utf8");
  const next = source.replace(
    /__CONFIG_LABEL__: JSON\.stringify\("\w+"\)/,
    `__CONFIG_LABEL__: JSON.stringify("${label}")`,
  );
  if (next !== source) fs.writeFileSync(configFile, next);
}

export const steps: Step[] = [
  (ctx) => changeConfigLabel(ctx, "two"),
  (ctx) => changeConfigLabel(ctx, "one"),
];

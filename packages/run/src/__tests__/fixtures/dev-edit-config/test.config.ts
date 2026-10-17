import fs from "fs";
import { join } from "path";

import type { Step, StepContext } from "../../main.test";

// Preview serves a fixed build; a config edit restarts only the dev server.
export const skip_preview = true;

const configFile = join(__dirname, "vite.config.ts");
const configSource = fs.readFileSync(configFile, "utf-8");

async function until(fn: () => Promise<boolean>, label: string) {
  const deadline = Date.now() + 8000;
  do {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

// The page shows a value of the config, so it changes only once Vite has
// restarted with the edit, and only if the routes still answer after it.
function serves(page: StepContext["page"], body: RegExp) {
  return page.fetch(new URL("/", page.url()).href).then(
    async (res) => res.status === 200 && body.test(await res.text()),
    () => false,
  );
}

function writeConfigValue(value: string) {
  fs.writeFileSync(
    configFile,
    configSource.replace(/"(before|after)"/, JSON.stringify(value)),
  );
}

async function editTheConfig({ page }: StepContext) {
  writeConfigValue("after");
  try {
    await until(() => serves(page, /config after/), "the edited config");
  } catch (error) {
    writeConfigValue("before");
    throw error;
  }
}

async function restoreTheConfig({ page }: StepContext) {
  writeConfigValue("before");
  await until(() => serves(page, /config before/), "the restored config");
}

export const steps: Step[] = [
  (ctx) => editTheConfig(ctx),
  (ctx) => restoreTheConfig(ctx),
];

import cluster from "cluster";
import fs from "fs";
import { join } from "path";

import type { Step, StepContext } from "../../main.test";

// Preview serves a fixed build; restarting the entry is a dev-only concern.
export const skip_preview = true;
export const entry = "src/index.ts";
export const timeout = 60000;

const files = {
  label: join(__dirname, "src", "label.ts"),
  layout: join(__dirname, "src", "routes", "+layout.marko"),
  viteConfig: join(__dirname, "vite.config.ts"),
};
const originals = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, read(file)]),
) as Record<keyof typeof files, string>;

// An aborted run can leave edits behind; the fixture must always start clean.
originals.label = 'export const serverLabel = "first";\n';
originals.layout = originals.layout.replace(/layout \w+/, "layout one");
originals.viteConfig = originals.viteConfig.replace(/\n\/\/ edited\n$/, "\n");
restoreFiles();

async function until(fn: () => Promise<boolean> | boolean, label: string) {
  const deadline = Date.now() + 10000;
  do {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

function workerIds() {
  return Object.keys(cluster.workers || {}).join(",");
}

function workerPids() {
  return Object.values(cluster.workers || {}).map((w) => w!.process.pid!);
}

function isRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function fetchRoot(page: StepContext["page"]) {
  return page.fetch(new URL("/", page.url()).href).catch(() => undefined);
}

async function serverLabelIs(page: StepContext["page"], label: string) {
  return (await fetchRoot(page))?.headers.get("x-server-label") === label;
}

async function changeServerLabel({ page }: StepContext, label: string) {
  const replaced = workerPids();
  fs.writeFileSync(files.label, `export const serverLabel = "${label}";\n`);
  await until(() => serverLabelIs(page, label), `server label "${label}"`);
  await until(
    () => !replaced.some(isRunning),
    "the replaced worker process to exit",
  );
}

async function editLayoutWithoutRestart({ page }: StepContext) {
  const ids = workerIds();
  fs.writeFileSync(files.layout, originals.layout.replace("layout one", "layout two"));
  await until(
    async () => (await (await fetchRoot(page))?.text())?.includes("layout two") ?? false,
    "the layout edit",
  );
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (workerIds() !== ids) {
    throw new Error("Editing the layout restarted the entry worker");
  }
}

async function editViteConfig({ page }: StepContext) {
  const ids = workerIds();
  fs.writeFileSync(files.viteConfig, originals.viteConfig + "\n// edited\n");
  await until(
    () => workerIds() !== ids && Object.keys(cluster.workers || {}).length === 1,
    "a fresh worker after the vite config edit",
  );
  await until(() => serverLabelIs(page, "second"), "the fresh worker to serve");
}

async function restoreAndSettle({ page }: StepContext) {
  restoreFiles();
  await until(() => serverLabelIs(page, "first"), "the restored entry");
}

function restoreFiles() {
  for (const key of Object.keys(files) as (keyof typeof files)[]) {
    if (read(files[key]) !== originals[key]) {
      fs.writeFileSync(files[key], originals[key]);
    }
  }
}

function read(file: string) {
  return fs.readFileSync(file, "utf8");
}

export const steps: Step[] = [
  (ctx) => changeServerLabel(ctx, "second"),
  (ctx) => editLayoutWithoutRestart(ctx),
  (ctx) => editViteConfig(ctx),
  (ctx) => changeServerLabel(ctx, "third"),
  (ctx) => restoreAndSettle(ctx),
];

// Compiles fixtures through the FROZEN workspace marko checkout
// (`3bcf2934b9` — the B1 freeze) so tests consume real
// `metadata.marko.updatePlan` carriers, never hand-built ones. The
// installed `marko`/`@marko/compiler` in this repo's node_modules predate
// the freeze (no updatePlan machinery), and this mocha process is
// tsx-hooked (which breaks the frozen compiler's native ESM graph), so
// compiles run in a subprocess in marko's own loading mode.
import { spawnSync } from "child_process";
import path from "path";
import { pathToFileURL } from "url";
import { Worker } from "worker_threads";

import type { PreliminaryUpdatePlans } from "../../../persisted-plan/finalize";

export const MARKO_REPO = path.resolve(
  import.meta.dirname,
  "../../../../../../../../marko",
);
export const FIXTURES = path.resolve(import.meta.dirname, "../fixtures");
export const APP_ENTRY = path.join(FIXTURES, "app/entry.marko");
export const SIMPLE_ENTRY = path.join(FIXTURES, "simple.marko");

const COMPILE_SCRIPT = path.join(import.meta.dirname, "compile-carrier.mjs");

export interface CompiledFixture {
  code: string;
  meta: Record<string, unknown>;
  /** `metadata.marko.updatePlan` (absent under suppression). */
  carrier: PreliminaryUpdatePlans | undefined;
  /** Virtual id (as returned to the compiler) -> served source. */
  virtualSources: Map<string, string>;
}

/** Mirrors the B1 harness (`marko/packages/runtime-tags/src/__tests__/
 * update-plan.test.ts`): persisted DOM entry compile with virtual capture.
 * `$foreignBabelPlugin: true` in overrides turns on the F-family
 * suppression trigger. */
export async function compileFixture(
  fixtureAbsPath: string,
  overrides?: Record<string, unknown>,
): Promise<CompiledFixture> {
  const args = [fixtureAbsPath, JSON.stringify(overrides ?? {})];
  const proc = spawnSync(process.execPath, [COMPILE_SCRIPT, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    // Loader-free on purpose: `npm test` exports NODE_OPTIONS="--import
    // tsx" and tsx's hooks break the frozen compiler's native ESM graph.
    // The timeout keeps a wedged child from holding mocha open.
    env: { ...process.env, NODE_OPTIONS: "" },
    timeout: 120_000,
  });
  let stdout = proc.stdout;
  let stderr = proc.stderr;
  let status = proc.status;
  // Some restricted runners deny child-process creation (`EPERM`) while
  // allowing worker isolates. Preserve the loader-free boundary with an
  // execArgv-empty worker so the native frozen compiler remains testable.
  if ((proc.error as NodeJS.ErrnoException | undefined)?.code === "EPERM") {
    const result = await runCompileWorker(args);
    stdout = result.stdout;
    stderr = result.stderr;
    status = result.status;
  }
  if (status !== 0) {
    throw new Error(
      `frozen-marko compile failed for ${fixtureAbsPath}` +
        `${proc.error ? ` (${String(proc.error)})` : ""}:\n${stderr}`,
    );
  }
  const parsed = JSON.parse(stdout) as {
    code: string;
    meta: Record<string, unknown>;
    virtualSources: [string, string][];
  };
  return {
    code: parsed.code,
    meta: parsed.meta,
    carrier: (parsed.meta as { updatePlan?: PreliminaryUpdatePlans })
      .updatePlan,
    virtualSources: new Map(parsed.virtualSources),
  };
}

function runCompileWorker(args: string[]) {
  return new Promise<{ stdout: string; stderr: string; status: number }>(
    (resolve, reject) => {
      const worker = new Worker(pathToFileURL(COMPILE_SCRIPT), {
        argv: args,
        execArgv: [],
        stdout: true,
        stderr: true,
      });
      let stdout = "";
      let stderr = "";
      worker.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
      });
      worker.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk;
      });
      worker.once("error", reject);
      worker.once("exit", (status) => resolve({ stdout, stderr, status }));
    },
  );
}

const memo = new Map<string, Promise<CompiledFixture>>();

/** Memoized default-config compile (frozen compiler => deterministic). */
export function compiledFixture(
  fixtureAbsPath: string,
): Promise<CompiledFixture> {
  let hit = memo.get(fixtureAbsPath);
  if (!hit) {
    hit = compileFixture(fixtureAbsPath);
    memo.set(fixtureAbsPath, hit);
  }
  return hit;
}

/** Deep-copies a compiled carrier so corruption-style gates never poison
 * the memoized original. */
export function cloneCarrier(
  carrier: PreliminaryUpdatePlans,
): PreliminaryUpdatePlans {
  return JSON.parse(JSON.stringify(carrier)) as PreliminaryUpdatePlans;
}

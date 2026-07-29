// The F-family integration harness: boots REAL vite dev servers
// (middlewareMode — never a listening port; shared machine) with the fork
// `@marko/vite` plugin compiling through the FROZEN workspace marko, and
// transforms the persisted entry four ways:
//   nohost           — baseline, no persistedPlanHost registered
//   host             — coordinator registered (harvest + finalize)
//   suppressed-nohost — foreign post-translator babel plugin, no host
//   suppressed-host   — foreign plugin AND host (F1: absence => print path)
// Emits one JSON report on stdout.
//
// Runs as a plain-node subprocess: the parent mocha process is tsx-hooked
// and tsx's CJS transpile breaks the frozen compiler's native ESM graph
// (dual-instance `types` interop). Only the fork's TS is transpiled here
// (esbuild load hook — it uses enums); everything else loads natively.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire, registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const runRepo = path.resolve(here, "../../../../../../..");
const markoRepo = path.resolve(runRepo, "../marko");
const forkVite = path.resolve(
  runRepo,
  "../marko-ecommerce/.marko-src/vite/src/index.ts",
);
const appTemplate = path.resolve(here, "../fixtures/vite-app");

// marko's own hooks: MARKO_DEBUG + the extensionless-import resolve
// fallback its translator sources rely on.
createRequire(path.join(markoRepo, "package.json"))("~ts");

// Re-parent every marko-package resolution into the frozen workspace
// checkout: the fork's own node_modules compiler PREDATES the B1 freeze
// (no updatePlan machinery) and must never load.
const markoParent = pathToFileURL(
  path.join(markoRepo, "packages/runtime-tags/_resolve_anchor.js"),
).href;
const REDIRECT = /^(@marko\/compiler|@marko\/runtime-tags|marko)(\/|$)/;
// The fork uses TS enums (non-erasable), which Node's native strip-only
// loader rejects — transpile JUST the fork's sources with esbuild (a vite
// dependency already present here); everything else stays native.
const forkDirUrl = pathToFileURL(path.dirname(forkVite) + path.sep).href;
let baselineForkDirUrl = "";
const esbuild = createRequire(path.join(runRepo, "package.json"))("esbuild");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (REDIRECT.test(specifier)) {
      return nextResolve(specifier, { ...context, parentURL: markoParent });
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (
      (url.startsWith(forkDirUrl) ||
        (baselineForkDirUrl && url.startsWith(baselineForkDirUrl))) &&
      url.endsWith(".ts")
    ) {
      const file = fileURLToPath(url);
      const { code } = esbuild.transformSync(fs.readFileSync(file, "utf8"), {
        loader: "ts",
        format: "esm",
        target: "node20",
        sourcefile: file,
      });
      return { format: "module", source: code, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// The app must live OUTSIDE the run repo: taglib discovery walks parent
// node_modules and would otherwise find the STALE upstream
// @marko/runtime-tags installed here. A temp copy with node_modules
// symlinked at the frozen packages keeps every marko surface on the
// freeze.
const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "persisted-plan-app-"));
fs.cpSync(appTemplate, appRoot, {
  recursive: true,
  filter: (src) => !src.includes("node_modules"),
});
const appModules = path.join(appRoot, "node_modules/@marko");
fs.mkdirSync(appModules, { recursive: true });
for (const [link, target] of [
  [path.join(appModules, "runtime-tags"), "packages/runtime-tags"],
  [path.join(appModules, "compiler"), "packages/compiler"],
  // The fork does not forward its translator option into the compiler
  // config; the compiler resolves "marko/translator" from cwd — keep that
  // on the freeze too.
  [path.join(appRoot, "node_modules/marko"), "packages/runtime-class"],
]) {
  fs.symlinkSync(path.join(markoRepo, target), link, "dir");
}
// Taglib/project discovery is cwd-anchored (markoModules.cwd): running
// from the run repo would rediscover the STALE upstream marko packages
// installed there. Anchor the process in the isolated app before the
// compiler loads.
process.chdir(appRoot);

process.on("exit", () => {
  try {
    fs.rmSync(appRoot, { recursive: true, force: true });
  } catch {
    // temp dir cleanup is best-effort
  }
});

async function loadPreC0Plugin() {
  if (process.env.G3_BASELINE_INSTALLED) {
    // Local proof before the ecommerce tarball is refreshed: that installed
    // package is the b6bd355 pre-C0 build.
    const installed = path.resolve(
      runRepo,
      "../marko-ecommerce/node_modules/@marko/vite/dist/index.mjs",
    );
    return (await import(pathToFileURL(installed).href)).default;
  }

  if (process.env.G3_BASELINE_FORK) {
    // A caller may pre-materialize the same parent checkout when its
    // execution sandbox forbids Node from spawning git. CI leaves this
    // unset and exercises the self-contained clone below.
    const supplied = path.resolve(process.env.G3_BASELINE_FORK);
    baselineForkDirUrl = pathToFileURL(
      path.join(supplied, "src") + path.sep,
    ).href;
    return (
      await import(pathToFileURL(path.join(supplied, "src/index.ts")).href)
    ).default;
  }

  // Permanent G3 path: materialize the pre-C0 vite baseline in a temp
  // clone. Prefer the pushed tag (reachable from a fresh origin fetch);
  // fall back to the historical full SHA if the tag is not yet fetched.
  const forkRepo = path.dirname(path.dirname(forkVite));
  const baselineRoot = path.join(appRoot, ".pre-c0-vite");
  const baselineRef =
    process.env.G3_BASELINE_REF || "g3-baseline-pre-c0";
  const baselineSha =
    process.env.G3_BASELINE_SHA ||
    "b6bd355d897aa249866118ff16be4e4ed8fb8d49";
  execFileSync(
    "git",
    ["clone", "--shared", "--no-checkout", forkRepo, baselineRoot],
    {
      stdio: "ignore",
    },
  );
  // Shallow workspace clones may lack the tag/object — fetch explicitly.
  try {
    execFileSync(
      "git",
      ["-C", baselineRoot, "fetch", "--depth", "1", "origin", `tag`, baselineRef],
      { stdio: "ignore" },
    );
  } catch {
    try {
      execFileSync(
        "git",
        ["-C", baselineRoot, "fetch", "--depth", "1", "origin", baselineSha],
        { stdio: "ignore" },
      );
    } catch {
      // Local object may already exist via --shared from a full fork clone.
    }
  }
  let checkedOut = false;
  for (const ref of [baselineRef, baselineSha]) {
    try {
      execFileSync(
        "git",
        ["-C", baselineRoot, "checkout", "--detach", ref],
        { stdio: "ignore" },
      );
      checkedOut = true;
      break;
    } catch {
      // try next
    }
  }
  if (!checkedOut) {
    throw new Error(
      `@marko/run G3: cannot materialize pre-C0 vite baseline (tried ${baselineRef} and ${baselineSha}). Fetch origin tag g3-baseline-pre-c0 or set G3_BASELINE_FORK.`,
    );
  }
  fs.symlinkSync(
    path.join(forkRepo, "node_modules"),
    path.join(baselineRoot, "node_modules"),
    "dir",
  );
  baselineForkDirUrl = pathToFileURL(
    path.join(baselineRoot, "src") + path.sep,
  ).href;
  return (
    await import(pathToFileURL(path.join(baselineRoot, "src/index.ts")).href)
  ).default;
}

const markoRequire = createRequire(
  path.join(markoRepo, "packages/runtime-tags/package.json"),
);
const translator = markoRequire.resolve("marko/translator");

const { createServer } = await import(
  pathToFileURL(path.join(runRepo, "node_modules/vite/dist/node/index.js")).href
);
const markoPlugin = (await import(pathToFileURL(forkVite).href)).default;
const { createPersistedPlanHost } = await import(
  pathToFileURL(
    path.join(runRepo, "packages/run/src/vite/persisted-plan/coordinator.ts"),
  ).href
);
const { createMarkoViteHost } = await import(
  pathToFileURL(
    path.join(runRepo, "packages/run/src/vite/persisted-plan/vite-resolver.ts"),
  ).href
);

/** The foreign post-translator transform (the F-family suppression
 * trigger): rewrites the fixture's sentinel literal so the report can
 * prove the plugin genuinely ran in-pipeline. */
const foreignBabelPlugin = {
  name: "test-foreign-plugin",
  visitor: {
    NumericLiteral(p) {
      if (p.node.value === 987654321) p.node.value = 123456789;
    },
  },
};

async function transformOnce({ withHost, suppressed, plugin = markoPlugin }) {
  const host = withHost ? createPersistedPlanHost() : undefined;
  const server = await createServer({
    root: appRoot,
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      plugin({
        // linked mode (the run-plugin default): the loader machinery rides
        // the linkAssets pipeline — without it load-marked imports degrade
        // and the frozen translator refuses the record mix.
        persisted: true,
        translator,
        ...(suppressed
          ? { babelConfig: { plugins: [foreignBabelPlugin] } }
          : null),
        ...(host
          ? {
              persistedBuild: {
                planHost: createMarkoViteHost(host),
                cutoverClientGraph: false,
              },
            }
          : null),
      }),
    ],
  });
  try {
    const result = await server.transformRequest("/entry.marko?persisted");
    const seal =
      host && !suppressed
        ? host.sealPartition(
            [
              {
                routeIndex: 0,
                templateFilePath: path.join(appRoot, "entry.marko"),
              },
            ],
            "build",
          )
        : null;
    return {
      code: result?.code ?? null,
      stats: host ? host.getGenerationStats() : null,
      partition: seal?.state ?? null,
      partitionStats: host ? host.getPartitionStats() : null,
    };
  } catch (err) {
    return {
      error: `${err?.name}: ${err?.message}`,
      stack: process.env.HARNESS_STACK ? String(err?.stack) : undefined,
    };
  } finally {
    await server.close();
  }
}

const preC0Plugin = await loadPreC0Plugin();
const report = {
  "pre-c0-parent": await transformOnce({
    withHost: false,
    suppressed: false,
    plugin: preC0Plugin,
  }),
  nohost: await transformOnce({ withHost: false, suppressed: false }),
  host: await transformOnce({ withHost: true, suppressed: false }),
  "suppressed-nohost": await transformOnce({
    withHost: false,
    suppressed: true,
  }),
  "suppressed-host": await transformOnce({ withHost: true, suppressed: true }),
};
process.stdout.write(JSON.stringify(report));

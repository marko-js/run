// C0-R2 real-watch harness. Every edit travels through a real Vite/chokidar
// configureServer + hotUpdate path; servers use middleware mode (no port)
// and every temp tree/server is removed/closed in finally blocks.
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
const watchTemplate = path.resolve(here, "../fixtures/watch-app");
const trace = (...args) => {
  if (process.env.HARNESS_TRACE) console.error("[watch-harness]", ...args);
};

const markoParent = pathToFileURL(
  path.join(markoRepo, "packages/runtime-tags/_resolve_anchor.js"),
).href;
const REDIRECT = /^(@marko\/compiler|@marko\/runtime-tags|marko)(\/|$)/;
const forkUrl = pathToFileURL(forkVite).href;
const transpileRoots = [
  pathToFileURL(path.dirname(forkVite) + path.sep).href,
  pathToFileURL(path.join(runRepo, "packages/run/src") + path.sep).href,
];
const esbuild = createRequire(path.join(runRepo, "package.json"))("esbuild");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@marko/vite") {
      return { url: forkUrl, shortCircuit: true };
    }
    if (REDIRECT.test(specifier)) {
      return nextResolve(specifier, { ...context, parentURL: markoParent });
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (
      url.endsWith(".ts") &&
      transpileRoots.some((rootUrl) => url.startsWith(rootUrl))
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

// Compiler/taglib discovery is cwd-anchored. Establish one isolated parent
// with only the frozen Marko packages before importing either plugin; each
// scenario app lives beneath it and inherits these node_modules.
const harnessRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "persisted-watch-harness-"),
);
fs.writeFileSync(
  path.join(harnessRoot, "package.json"),
  '{"name":"persisted-watch-harness","private":true,"type":"module"}\n',
);
const harnessMarkoModules = path.join(harnessRoot, "node_modules/@marko");
fs.mkdirSync(harnessMarkoModules, { recursive: true });
for (const [link, target] of [
  [path.join(harnessMarkoModules, "runtime-tags"), "packages/runtime-tags"],
  [path.join(harnessMarkoModules, "compiler"), "packages/compiler"],
  [path.join(harnessRoot, "node_modules/marko"), "packages/runtime-class"],
]) {
  fs.symlinkSync(path.join(markoRepo, target), link, "dir");
}
process.chdir(harnessRoot);
// marko's own hooks: MARKO_DEBUG + extensionless TS resolution. Load only
// after cwd points at the frozen-package anchor because the compiler
// snapshots its module-discovery root at first import.
createRequire(path.join(markoRepo, "package.json"))("~ts");

const { createServer } = await import(
  pathToFileURL(path.join(runRepo, "node_modules/vite/dist/node/index.js")).href
);
const markoPlugin = (await import(forkUrl)).default;
const markoRun = (
  await import(
    pathToFileURL(path.join(runRepo, "packages/run/src/vite/plugin.ts")).href
  )
).default;
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
const translator = createRequire(
  path.join(markoRepo, "packages/runtime-tags/package.json"),
).resolve("marko/translator");

const tempRoots = new Set([harnessRoot]);
process.on("exit", () => {
  for (const root of tempRoots) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // Temp cleanup is best-effort on process exit.
    }
  }
});

function makeApp() {
  const root = fs.mkdtempSync(path.join(harnessRoot, "app-"));
  tempRoots.add(root);
  fs.cpSync(watchTemplate, root, { recursive: true });
  const markoModules = path.join(root, "node_modules/@marko");
  fs.mkdirSync(markoModules, { recursive: true });
  for (const [link, target] of [
    [path.join(markoModules, "runtime-tags"), "packages/runtime-tags"],
    [path.join(markoModules, "compiler"), "packages/compiler"],
    [path.join(root, "node_modules/marko"), "packages/runtime-class"],
  ]) {
    fs.symlinkSync(path.join(markoRepo, target), link, "dir");
  }
  return root;
}

function cleanupApp(root) {
  tempRoots.delete(root);
  fs.rmSync(root, { recursive: true, force: true });
}

function waitForChange(server, file) {
  const target = path.resolve(file);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.watcher.off("change", onChange);
      reject(new Error(`watch timeout for ${target}`));
    }, 10_000);
    function onChange(changed) {
      if (path.resolve(changed) !== target) return;
      clearTimeout(timer);
      server.watcher.off("change", onChange);
      setTimeout(resolve, 50);
    }
    server.watcher.on("change", onChange);
  });
}

async function edit(server, file, content) {
  trace("edit", file, content.includes("watch-v0") ? "v0" : "variant");
  const changed = waitForChange(server, file);
  fs.writeFileSync(file, content);
  await changed;
  // The persisted facade has an internal module id; a real rebuild driver
  // invalidates that facade after the source-file watch event. Keep the
  // invalidation explicit here so every subsequent transform is a rebuild,
  // while classification/cancellation still comes only from real watcher
  // and hotUpdate hooks.
  server.moduleGraph.invalidateAll();
  trace("changed", file);
}

async function close(server, root) {
  try {
    await server.close();
  } finally {
    cleanupApp(root);
  }
}

const PAGE_V0 = `static const label = "watch-v0";

<let/count=0>
<button onClick() { count++ }>\${label}: \${count}</button>
`;
const PAGE_V1 = PAGE_V0.replace("<button ", "<button.watch-v1 ");
const PAGE_V2 = PAGE_V0.replace("<button ", "<button.watch-v2 ");

async function directWatchScenario() {
  const root = makeApp();
  process.chdir(root);
  const page = path.join(root, "src/routes/+page.marko");
  const host = createPersistedPlanHost();
  const adapter = createMarkoViteHost(host);
  const fingerprints = [];
  const planBytes = [];
  let ensureStarted = () => {};
  let startSignal;
  const observedHost = {
    ...adapter,
    async ensureFinalized(intake) {
      ensureStarted();
      const delayed = {
        ...intake,
        async resolve(...args) {
          await new Promise((resolve) => setTimeout(resolve, 35));
          return intake.resolve(...args);
        },
      };
      const set = await adapter.ensureFinalized(delayed);
      if (set) {
        fingerprints.push(set.entry.fingerprint);
        planBytes.push(JSON.stringify(set));
      }
      return set;
    },
  };
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    server: {
      middlewareMode: true,
      watch: { usePolling: true, interval: 20 },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      markoPlugin({
        persisted: true,
        translator,
        persistedBuild: {
          planHost: observedHost,
          cutoverClientGraph: false,
        },
      }),
    ],
  });
  try {
    const url = "/src/routes/+page.marko?persisted";
    const codes = [];
    await server.transformRequest("/src/routes/+page.marko");
    trace("direct initial transform");
    codes.push((await server.transformRequest(url))?.code ?? "");
    trace("direct initial done");
    for (const content of [PAGE_V1, PAGE_V0, PAGE_V2, PAGE_V0]) {
      await edit(server, page, content);
      startSignal = new Promise((resolve) => (ensureStarted = resolve));
      codes.push((await server.transformRequest(url))?.code ?? "");
      trace("direct cycle done", fingerprints.length);
    }
    const aPlus = {
      fingerprints: fingerprints.slice(),
      planBytes: planBytes.slice(),
      codes,
      stats: host.getGenerationStats().client,
    };

    // Fixed adversarial schedule: each second edit lands while the prior
    // generation is blocked in a real resolver call.
    const pending = [];
    for (const [first, second] of [
      [PAGE_V1, PAGE_V2],
      [PAGE_V2, PAGE_V1],
    ]) {
      await edit(server, page, first);
      startSignal = new Promise((resolve) => (ensureStarted = resolve));
      const transform = server.transformRequest(url);
      pending.push(transform);
      trace("thrash transform started");
      await startSignal;
      trace("thrash ensure started");
      await edit(server, page, second);
    }
    await Promise.allSettled(pending);
    trace("thrash pending settled");
    await edit(server, page, PAGE_V0);
    startSignal = new Promise((resolve) => (ensureStarted = resolve));
    await server.transformRequest(url);
    const finalFingerprint = fingerprints.at(-1);
    const stats = host.getGenerationStats().client;
    const committedFingerprints = fingerprints.slice();

    // Fork half of C5: a real watched route-handler module must not trigger
    // @marko/vite's compiler-cache W4 coupling.
    const handler = path.join(root, "src/routes/+handler.ts");
    await server.transformRequest("/src/routes/+handler.ts");
    const beforeForkW3 = host.getGenerationStats().client;
    await edit(
      server,
      handler,
      `export const GET = () => new Response("fork-handler-v1");\n`,
    );
    const afterForkW3Event = host.getGenerationStats().client;
    await server.transformRequest(url);
    const afterForkW3Warm = host.getGenerationStats().client;
    return {
      aPlus,
      c4: {
        stats,
        committedFingerprints,
        finalFingerprint,
      },
      c5Fork: {
        before: beforeForkW3,
        afterEvent: afterForkW3Event,
        afterWarm: afterForkW3Warm,
      },
    };
  } finally {
    await close(server, root);
  }
}

async function runWatchScenario() {
  const root = makeApp();
  process.chdir(root);
  const page = path.join(root, "src/routes/+page.marko");
  const handler = path.join(root, "src/routes/+handler.ts");
  const plugins = markoRun({ persisted: true, translator, adapter: null });
  const pre = plugins.find((plugin) => plugin.name === "marko-run-vite:pre");
  const getStats = () => pre.api.getPersistedPlanStats().client;
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    server: {
      middlewareMode: true,
      hmr: false,
      watch: { usePolling: true, interval: 20 },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins,
  });
  try {
    const url = "/src/routes/+page.marko?persisted";
    await server.transformRequest("/src/routes/+page.marko");
    trace("run initial transform");
    await server.transformRequest(url);
    trace("run initial done");
    const beforeW1 = getStats();
    await edit(server, page, PAGE_V1);
    const afterW1Event = getStats();
    await server.transformRequest(url);
    const afterW1Rebuild = getStats();

    // Restore and establish one clean warm baseline before the W3 storm.
    await edit(server, page, PAGE_V0);
    await server.transformRequest(url);
    await server.transformRequest(url);
    const beforeC5 = getStats();
    await edit(
      server,
      handler,
      `export const GET = () => new Response("handler-v1");\n`,
    );
    const afterC5Event = getStats();
    await server.transformRequest(url);
    const afterC5Warm = getStats();
    return {
      w1: {
        before: beforeW1,
        afterEvent: afterW1Event,
        afterRebuild: afterW1Rebuild,
      },
      c5: {
        before: beforeC5,
        afterEvent: afterC5Event,
        afterWarm: afterC5Warm,
      },
    };
  } finally {
    await close(server, root);
  }
}

const direct = await directWatchScenario();
const run = await runWatchScenario();
process.stdout.write(JSON.stringify({ ...run, ...direct }));

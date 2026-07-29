// C2 live measurement harness: builds the flat/shared probe apps as real
// consumers of the publish-shaped tarballs packed by marko-ecommerce's
// setup script (`pnpm run setup`, optionally with MARKO_SRC pointing at the
// sibling checkouts), then measures the /r0 -> /r1 patch wire and the
// first-load JS request count against real ephemeral-port preview servers.
//
// The apps install from tarballs instead of module-hook redirection on
// purpose: resolve/load hooks cannot reach vite's esbuild config bundling
// or the translator's CJS require chain, so a hook-based app silently
// builds with the stock @marko/vite (no update-plan carrier) and walks the
// symlinked repo trees out of memory. A tarball install resolves every
// package the way a user install would.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync } from "node:zlib";

import { cleanEnv } from "./clean-env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const runRepo = path.resolve(here, "../../../../../../..");
const tarballDir = path.resolve(
  runRepo,
  "../marko-ecommerce/.marko-src/tarballs",
);

const { BrowserPage } = await import(
  pathToFileURL(
    path.join(runRepo, "packages/run/src/__tests__/utils/browser.ts"),
  ).href
);

const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "c2-measurement-gates-"),
);
process.on("exit", () => {
  if (process.env.C2_GATES_KEEP) return;
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup of a test-only temp root.
  }
});

const apps = {
  flat: createApp("flat"),
  shared: createApp("shared"),
};
for (const root of Object.values(apps)) installApp(root);
const builds = {
  flat: {
    dual: buildApp(apps.flat, "dual"),
    c2: buildApp(apps.flat, "c2"),
  },
  shared: {
    dual: buildApp(apps.shared, "dual"),
    c2: buildApp(apps.shared, "c2"),
  },
};

const wire = {
  dual: await withServer(builds.flat.dual, capturePatch),
  c2: await withServer(builds.flat.c2, capturePatch),
};
const run1 = {
  dual: await withServer(builds.shared.dual, captureFirstLoad),
  c2: await withServer(builds.shared.c2, captureFirstLoad),
};

process.stdout.write(`C2_MEASUREMENT_REPORT ${JSON.stringify({ wire, run1 })}`);
process.exit(0);

function createApp(shape) {
  const root = path.join(tempRoot, shape);
  const routes = path.join(root, "src/routes");
  fs.mkdirSync(routes, { recursive: true });
  write(
    path.join(routes, "+layout.marko"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Route-scale probe</title>
  </head>
  <body>
    <main><\${input.content}/></main>
  </body>
</html>
`,
  );
  if (shape === "flat") {
    for (let index = 0; index < 10; index++) {
      write(
        path.join(routes, `r${index}+page.marko`),
        `<h2>Route ${index}</h2>
<p>Flat shape, page ${index}.</p>
<a href=Run.href("/r${(index + 1) % 10}")>Next</a>
`,
      );
    }
  } else {
    write(
      path.join(root, "src/tags/doc-page.marko"),
      `<h2>Doc \${input.n}</h2>
<p>Shared-template shape, document \${input.n}.</p>
<a href=input.next>Next</a>
`,
    );
    for (let index = 0; index < 10; index++) {
      write(
        path.join(routes, `d${index}+page.marko`),
        `<doc-page n=${index} next=Run.href("/d${(index + 1) % 10}")/>\n`,
      );
    }
  }
  // The same dependency shape as the ecommerce fixture: overrides force
  // every transitive marko package to the packed tarballs (the fork
  // @marko/vite and the frozen compiler included).
  const tarball = (name) => `file:${path.join(tarballDir, name)}`;
  write(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: `route-scale-${shape}`,
        type: "module",
        private: true,
        dependencies: {
          "@marko/run": tarball("marko-run.tgz"),
          marko: tarball("marko.tgz"),
        },
        // Direct devDependencies satisfy the run plugin's peer ranges (a
        // peer auto-installed by pnpm resolves from the registry, not the
        // overrides); the workspace overrides catch every other edge.
        devDependencies: {
          "@marko/compiler": tarball("marko-compiler.tgz"),
          "@marko/vite": tarball("marko-vite.tgz"),
          vite: "^8.0.7",
        },
      },
      null,
      2,
    )}\n`,
  );
  write(
    path.join(root, "pnpm-workspace.yaml"),
    `overrides:
  marko: ${JSON.stringify(tarball("marko.tgz"))}
  "@marko/compiler": ${JSON.stringify(tarball("marko-compiler.tgz"))}
  "@marko/vite": ${JSON.stringify(tarball("marko-vite.tgz"))}
allowBuilds:
  esbuild: true
`,
  );
  return root;
}

/** Suite tests mutate process.env (the fork writes MARKO_DEBUG; protocol
 * tests export MARKO_PERSISTED_* overrides). None of that may leak into the
 * measured builds or servers — a leaked MARKO_DEBUG builds unoptimized
 * output and moves the wire baseline. cleanEnv lives in ./clean-env.mjs. */

function installApp(root) {
  const proc = spawnSync("pnpm", ["install", "--prefer-offline"], {
    cwd: root,
    encoding: "utf8",
    env: cleanEnv(),
    maxBuffer: 64 * 1024 * 1024,
    timeout: 240_000,
  });
  if (proc.status !== 0) {
    throw new Error(
      `pnpm install failed (exit ${proc.status}) in ${root}:\n${proc.stderr}\n${proc.stdout}`,
    );
  }
}

function buildApp(root, mode) {
  const config = "vite.config.ts";
  // Dual control: setArtifactEmissionForTest(false) on globalThis before the
  // plugin configures — not a product Options/env surface.
  const dual = mode === "dual";
  write(
    path.join(root, config),
    dual
      ? `import marko, { setArtifactEmissionForTest } from "@marko/run/vite";
setArtifactEmissionForTest(false);
export default { plugins: marko({ persisted: true }) };
`
      : `import marko from "@marko/run/vite";
export default { plugins: marko({ persisted: true }) };
`,
  );
  const outDir = `dist-${mode}`;
  const proc = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/@marko/run/dist/cli/index.mjs"),
      "build",
      "-c",
      config,
      "-o",
      outDir,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: cleanEnv({
        NODE_ENV: "production",
      }),
      maxBuffer: 64 * 1024 * 1024,
      timeout: 240_000,
    },
  );
  if (proc.status !== 0) {
    throw new Error(
      `marko-run build (${mode}) failed (exit ${proc.status}) in ${root}:\n${proc.stderr}\n${proc.stdout}`,
    );
  }
  return path.join(root, outDir);
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

async function withServer(dist, run) {
  const port = await freePort();
  const entry = path.join(dist, "index.mjs");
  const child = spawn(process.execPath, [entry], {
    cwd: dist,
    env: cleanEnv({ NODE_ENV: "production", PORT: String(port) }),
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  let result;
  let failure;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => (stderr += chunk));
  try {
    const base = `http://127.0.0.1:${port}`;
    await ready(base);
    result = await run(base, dist);
  } catch (error) {
    failure = error;
  }
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 2_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (!failure && child.exitCode && child.exitCode !== 143) {
    failure = new Error(`preview server exited ${child.exitCode}: ${stderr}`);
  }
  if (failure) throw failure;
  return result;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) =>
        error
          ? reject(error)
          : resolve(
              /** @type {import("node:net").AddressInfo} */ (address).port,
            ),
      );
    });
  });
}

async function ready(base) {
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      const response = await fetch(base);
      await response.arrayBuffer();
      return;
    } catch (error) {
      void error;
    }
    if (Date.now() > deadline) {
      throw new Error(`preview server not ready: ${base}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function capturePatch(base, dist) {
  const serverSource = fs.readFileSync(path.join(dist, "index.mjs"), "utf8");
  const buildId = serverSource.match(
    /function buildId\(\) \{\s*return "([^"]+)";/,
  )?.[1];
  if (!buildId) throw new Error("C2-Wire1 could not find buildId");
  const assetsDir = path.join(dist, "public/assets");
  const routeTable = fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js"))
    .filter((name) => {
      const map = path.join(assetsDir, `${name}.map`);
      return (
        fs.existsSync(map) &&
        JSON.parse(fs.readFileSync(map, "utf8")).sources.some((source) =>
          source.includes("__marko-run__routes.client"),
        )
      );
    })
    .map((name) => fs.readFileSync(path.join(assetsDir, name), "utf8"))
    .join("\n");
  const fromId = routeIdFor(routeTable, "/r0");
  const targetId = routeIdFor(routeTable, "/r1");
  const response = await rawGet(base, "/r1", {
    accept: "text/marko-patch",
    "x-marko-route": String(targetId),
    "x-marko-from": String(fromId),
    "x-marko-build": buildId,
  });
  if (
    response.status !== 200 ||
    !response.headers["content-type"]?.includes("text/javascript")
  ) {
    throw new Error(
      `C2-Wire1 negotiation failed: ${response.status} ${response.headers["content-type"]}`,
    );
  }
  // The patch embeds per-build content hashes: the build id and the
  // linkAssets asset ids the server registers via `_script(...)` for the
  // route's client scripts. Substituting same-length placeholders keeps the
  // raw length honest while making the body (and its brotli size)
  // comparable across builds — placeholder count and position still change
  // if C2 alters what the patch references.
  let normalized = response.body
    .toString("latin1")
    .replaceAll(buildId, "#".repeat(buildId.length));
  for (const [, assetId] of serverSource.matchAll(
    /_script\([^,)]+, "([\w-]+)"\)/g,
  )) {
    normalized = normalized.replaceAll(assetId, "#".repeat(assetId.length));
  }
  return {
    raw: response.body.length,
    brotli: brotliCompressSync(Buffer.from(normalized, "latin1")).length,
    body: Buffer.from(normalized, "latin1").toString("base64"),
  };
}

function routeIdFor(source, pathname) {
  for (const entries of [
    /\[(\d+),\(\)=>.*?,(\/\^(?:[^/\\]|\\.)*\/)\]/g,
    /\[(\d+),(\/\^(?:[^/\\]|\\.)*\/),/g,
  ]) {
    for (const [, routeId, regexLiteral] of source.matchAll(entries)) {
      if (new RegExp(regexLiteral.slice(1, -1)).test(pathname)) {
        return Number(routeId);
      }
    }
  }
  throw new Error(`C2-Wire1 found no route for ${pathname}`);
}

function rawGet(base, pathname, headers) {
  return new Promise((resolve, reject) => {
    const request = http.get(new URL(base + pathname), {
      headers: { host: "route-scale.probe", ...headers },
    });
    request.once("error", reject);
    request.once("response", (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.once("end", () =>
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks),
        }),
      );
    });
  });
}

async function captureFirstLoad(base) {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    if (
      (!init?.method || init.method === "GET") &&
      response.headers.get("content-type")?.includes("javascript")
    ) {
      urls.push(new URL(response.url).pathname);
    }
    return response;
  };
  const page = new BrowserPage();
  try {
    await page.goto(`${base}/d0`);
    await page.settle();
    const error = page.document.getElementById("error")?.textContent;
    if (error) throw new Error(`C2-Run1 browser error: ${error}`);
  } finally {
    await page.close();
    globalThis.fetch = originalFetch;
  }
  return { requests: urls.length, urls: urls.sort() };
}

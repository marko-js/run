import path from "path";
import { build, BuildOptions } from "esbuild";
import { copyFile, mkdir, lstat, cp } from "fs/promises";

const srcdir = path.resolve("src");
const outdir = path.resolve("dist");

const opts: BuildOptions = {
  entryPoints: [
    "src/vite/index.ts",
    "src/runtime/index.ts",
    "src/runtime/router.ts",
    "src/runtime/internal.ts",
    "src/adapter/index.ts",
    "src/adapter/middleware.ts",
  ],
  outdir,
  outbase: srcdir,
  platform: "node",
  target: ["node14"],
  bundle: true,
  plugins: [
    {
      name: "external-modules",
      setup(build) {
        build.onResolve(
          { filter: /^[^./]|^\.[^./]|^\.\.[^/]/ },
          ({ path }) => ({
            path,
            external: true,
          })
        );
      },
    },
  ],
};

await Promise.all([
  build({
    ...opts,
    format: "cjs",
    outExtension: { ".js": ".cjs" },
  }),
  build({
    ...opts,
    format: "esm",
    splitting: !true,
  }),
  build({
    ...opts,
    entryPoints: ["src/cli/index.ts"],
    format: "esm",
    outExtension: { ".js": ".mjs" },
  }),
  copy(
    "cli/default.config.mjs",
    "adapter/default-entry.mjs",
    "adapter/load-dev-worker.mjs",
    "components"
  ),
]);

async function copy(...items: ([string, string] | [string] | string)[]) {
  for (const item of items) {
    let from, to;
    if (Array.isArray(item)) {
      [from, to] = item;
    } else {
      from = item;
    }
    if (from) {
      to = path.join(outdir, to || from);
      from = path.join(srcdir, from);

      try {
        await mkdir(path.dirname(to), { recursive: true });
      } catch (err: any) {
        if (err && err.code !== "EEXIST") {
          throw err;
        }
      }

      if ((await lstat(from)).isDirectory()) {
        await cp(from, to, { recursive: true });
      } else {
        await copyFile(from, to);
      }
    }
  }
}

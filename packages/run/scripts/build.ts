import { build, BuildOptions } from "esbuild";
import { copyFile, cp, lstat, mkdir } from "fs/promises";
import path from "path";

const srcdir = path.resolve("src");
const outdir = path.resolve("dist");

const opts: BuildOptions = {
  entryPoints: [
    "src/vite/index.ts",
    "src/runtime/index.ts",
    "src/runtime/router.ts",
    "src/runtime/client.ts",
    "src/runtime/url-builder.ts",
    "src/runtime/internal.ts",
    "src/runtime/persisted.ts",
    "src/runtime/persisted-protocol.ts",
    "src/runtime/persisted-navigation.ts",
    "src/adapter/index.ts",
    "src/adapter/middleware.ts",
  ],
  outdir,
  outbase: srcdir,
  platform: "node",
  target: ["node14"],
  bundle: true,
  treeShaking: true,
  define: {
    "process.env.npm_package_version": JSON.stringify(
      process.env.npm_package_version || "",
    ),
  },
  plugins: [
    {
      // Keep the navigation engine behind the browser's first persisted
      // navigation. Both files are explicit entries, so the relative import is
      // valid in dist without enabling package-wide chunk splitting.
      name: "lazy-persisted-navigation",
      setup(build) {
        build.onResolve(
          { filter: /^\.\/persisted-navigation\.js$/ },
          ({ path }) => ({ path, external: true }),
        );
      },
    },
    {
      name: "external-modules",
      setup(build) {
        build.onResolve(
          { filter: /^[^./]|^\.[^./]|^\.\.[^/]/ },
          ({ path }) => ({
            path,
            external: true,
          }),
        );
      },
    },
  ],
};

await Promise.all([
  build({
    ...opts,
    // The persisted runtime is browser-only and relies on
    // `import.meta.env`; it ships esm-only.
    entryPoints: (opts.entryPoints as string[]).filter(
      (entry) => !entry.includes("/persisted"),
    ),
    format: "cjs",
    outExtension: { ".js": ".cjs" },
    define: {
      ...opts.define,
      "import.meta.url": "__importMetaURL",
    },
    inject: ["./scripts/importMetaURL.js"],
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
    "components",
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

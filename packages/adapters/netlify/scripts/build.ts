import path from "path";
import { build, BuildOptions } from "esbuild";

const srcdir = path.resolve("src");
const outdir = path.resolve("dist");

const opts: BuildOptions = {
  entryPoints: ["src/index.ts"],
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
    splitting: true,
  }),
  build({
    ...opts,
    entryPoints: [
      "src/default-edge-entry.ts",
      "src/default-functions-entry.ts",
    ],
    format: "esm",
    outExtension: { ".js": ".mjs" },
  }),
]);

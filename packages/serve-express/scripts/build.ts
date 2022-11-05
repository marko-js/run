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
};

await Promise.all([
  build({
    ...opts,
    format: "cjs",
    bundle: true,
    outExtension: { ".js": ".cjs" },
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
  }),
  build({
    ...opts,
    format: "esm",
    bundle: true,
    splitting: true,
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
  }),
]);
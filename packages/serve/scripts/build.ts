import path from "path";
import { build, BuildOptions } from "esbuild";

const srcdir = path.resolve("src");
const outdir = path.resolve("dist");

const opts: BuildOptions = {
  entryPoints: ["src/vite/index.ts", "src/runtime/index.ts", "src/runtime/router.ts"],
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
]);
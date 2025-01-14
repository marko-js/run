import { build, BuildOptions } from "esbuild";
import path from "path";

const srcdir = path.resolve("src");
const outdir = path.resolve("dist");

const opts: BuildOptions = {
  entryPoints: ["src/index.ts", "src/middleware.ts"],
  outdir,
  outbase: srcdir,
  platform: "node",
  target: ["node14"],
  plugins: [
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
    format: "cjs",
    bundle: true,
    outExtension: { ".js": ".cjs" },
    define: {
      "import.meta.url": "__importMetaURL",
    },
    inject: ["./scripts/importMetaURL.js"],
  }),
  build({
    ...opts,
    format: "esm",
    bundle: true,
    splitting: true,
  }),
]);

import path from "path";
import { build, BuildOptions } from "esbuild";

const outdir = path.resolve("dist");

const opts: BuildOptions = {
  entryPoints: [
    "index.ts",
    "server.ts",
  ],
  outdir,
  platform: "node",
  target: ["node14"],
  bundle: true,
  treeShaking: true,
  define: {
    "process.env.npm_package_version": JSON.stringify(
      process.env.npm_package_version || ""
    ),
  },
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
]);

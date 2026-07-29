// Compiles a fixture through the FROZEN workspace marko checkout in
// marko's own native loading mode (Node type-stripping + ESM). Run as a
// subprocess: the parent mocha process is tsx-hooked, and tsx's CJS
// transpile breaks the frozen compiler's ESM graph — so carriers are
// produced here and shipped back as JSON.
//
// argv: <fixtureAbsPath> <overridesJson>
// overrides: plain compiler-config JSON, plus the marker keys
//   "$foreignBabelPlugin": true  -> adds a post-translator babel plugin
//                                   (the F-family suppression trigger)
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const markoRepo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../../../marko",
);
const markoRequire = createRequire(
  path.join(markoRepo, "packages/runtime-tags/package.json"),
);

// marko's own test hooks (the "~ts" workspace alias — pnpm keeps its deps
// beside the symlink): MARKO_DEBUG, complain silencing, and the
// extensionless-import resolve fallback the translator sources rely on.
createRequire(path.join(markoRepo, "package.json"))("~ts");

const [, , fixturePath, overridesJson] = process.argv;
const rawOverrides = overridesJson ? JSON.parse(overridesJson) : {};
const { $foreignBabelPlugin, ...overrides } = rawOverrides;

const compiler = await import(
  pathToFileURL(path.join(markoRepo, "packages/compiler/src/index.js")).href
);

const virtualSources = [];
const babelConfig = {
  babelrc: false,
  configFile: false,
  browserslistConfigFile: false,
};
if ($foreignBabelPlugin) {
  // A foreign post-translator transform: the frozen gate suppresses the
  // plan because printed text could drift from executed text (B1 F-family).
  babelConfig.plugins = [
    {
      name: "test-foreign-plugin",
      visitor: {
        NumericLiteral(p) {
          if (p.node.value === 987654321) p.node.value = 123456789;
        },
      },
    },
  ];
}

const result = compiler.compileFileSync(fixturePath, {
  translator: markoRequire.resolve("marko/translator"),
  cache: new Map(),
  output: "dom",
  persisted: true,
  entry: "persisted",
  writeVersionComment: false,
  linkAssets: { runtime: "asset-runtime", onAsset() {} },
  resolveVirtualDependency: (_from, dep) => {
    const id = `./${dep.virtualPath}`;
    virtualSources.push([id, dep.code]);
    return id;
  },
  babelConfig,
  ...overrides,
});

process.stdout.write(
  JSON.stringify({
    code: result.code,
    meta: result.meta,
    virtualSources,
  }),
);

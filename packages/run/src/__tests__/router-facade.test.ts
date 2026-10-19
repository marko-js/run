import assert from "assert";
import { execFileSync } from "child_process";
import { build, type BuildOptions } from "esbuild";
import fs from "fs";
import os from "os";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const source = path.join(__dirname, "../runtime/router.ts");

// A CommonJS consumer of the published `@marko/run/router`: `require` gets the
// cjs build, whose lazy `import()` gets the esm one, as the package exports map.
describe("router facade (CommonJS)", () => {
  let dir: string;

  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "router-facade-"));
    const pkgDir = path.join(dir, "node_modules/@marko/run");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({
        name: "@marko/run",
        type: "module",
        exports: {
          "./router": { import: "./router.js", require: "./router.cjs" },
        },
      }),
    );
    // As scripts/build.ts builds the runtime entries.
    const opts: BuildOptions = {
      entryPoints: [source],
      bundle: true,
      platform: "node",
      target: ["node14"],
      external: ["@marko/run/router"],
      logLevel: "silent",
    };
    await Promise.all([
      build({
        ...opts,
        format: "cjs",
        outfile: path.join(pkgDir, "router.cjs"),
      }),
      build({
        ...opts,
        format: "esm",
        outfile: path.join(pkgDir, "router.js"),
      }),
    ]);
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("calls a loaded router directly", () => {
    const result = run(`
      globalThis.__marko_run__ = { fetch: () => "loaded" };
      const result = fetch(new Request("http://test/"), {});
      console.log(JSON.stringify(result));
    `);
    assert.equal(result, "loaded");
  });

  it("throws the plugin error when nothing loaded the router", () => {
    const result = run(`
      fetch(new Request("http://test/"), {}).then(
        () => console.log(JSON.stringify("resolved")),
        (err) => console.log(JSON.stringify(err.message)),
      );
    `);
    assert.match(result, /replaced by the @marko\/run plugin/);
  });

  function run(body: string) {
    const file = path.join(dir, "consumer.cjs");
    fs.writeFileSync(
      file,
      `const { fetch } = require("@marko/run/router");\n${body}`,
    );
    return JSON.parse(
      execFileSync(process.execPath, [file], {
        cwd: dir,
        // The test env's `--import tsx` cannot resolve from the temp dir.
        env: { ...process.env, NODE_OPTIONS: "" },
        encoding: "utf8",
      }),
    );
  }
});

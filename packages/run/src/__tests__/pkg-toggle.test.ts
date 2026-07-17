import assert from "assert";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const script = path.join(__dirname, "../../../../scripts/pkg-toggle.js");

const packageData = {
  name: "fixture",
  version: "1.0.0",
  exports: { ".": "./src/index.ts" },
  types: "./src/index.ts",
};

// `typesVersions` exists only on the toggle side: it must migrate into
// package.json for a release and back off of it afterward.
const toggleData = {
  exports: { ".": "./dist/index.js" },
  types: "./dist/index.d.ts",
  typesVersions: { "*": { "*": ["./dist/index.d.ts"] } },
};

describe("pkg-toggle", () => {
  let dir: string;
  let packageFile: string;
  let toggleFile: string;

  const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
  const toggle = () =>
    execFileSync(process.execPath, [script], {
      cwd: dir,
      // The test env's `--import tsx` cannot resolve from the temp dir.
      env: { ...process.env, NODE_OPTIONS: "" },
    });

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-toggle-"));
    const pkgDir = path.join(dir, "packages", "fixture");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.mkdirSync(path.join(dir, "packages", "adapters"), { recursive: true });
    packageFile = path.join(pkgDir, "package.json");
    toggleFile = path.join(pkgDir, "package.toggle.json");
    fs.writeFileSync(packageFile, JSON.stringify(packageData, null, 2) + "\n");
    fs.writeFileSync(toggleFile, JSON.stringify(toggleData, null, 2) + "\n");
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips toggle-only keys across two runs", () => {
    toggle();
    assert.deepEqual(read(packageFile), {
      name: "fixture",
      version: "1.0.0",
      exports: toggleData.exports,
      types: toggleData.types,
      typesVersions: toggleData.typesVersions,
    });
    // The absent-on-package.json key survives as an explicit null marker.
    assert.deepEqual(read(toggleFile), {
      exports: packageData.exports,
      types: packageData.types,
      typesVersions: null,
    });

    toggle();
    assert.deepEqual(read(packageFile), packageData);
    assert.deepEqual(read(toggleFile), toggleData);
  });

  it("is byte-stable across further toggle cycles", () => {
    const packageBytes = fs.readFileSync(packageFile, "utf8");
    const toggleBytes = fs.readFileSync(toggleFile, "utf8");
    toggle();
    toggle();
    assert.equal(fs.readFileSync(packageFile, "utf8"), packageBytes);
    assert.equal(fs.readFileSync(toggleFile, "utf8"), toggleBytes);
  });
});

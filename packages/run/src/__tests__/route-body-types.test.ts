import assert from "assert";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import url from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("test sources type-check", () => {
  // The package build excludes `__tests__`, so this compile is what makes
  // the suite's type assertions (`types/route-body.ts`) and the tests
  // themselves hold together as TypeScript.
  it("should type-check the test sources", function () {
    this.timeout(120000);
    const result = spawnSync(
      process.execPath,
      [
        require.resolve("typescript/lib/tsc.js"),
        "-p",
        path.join(__dirname, "..", "..", "tsconfig.test.json"),
        "--pretty",
        "false",
      ],
      // Bounded here because mocha's timeout cannot interrupt a synchronous
      // spawn — a hung tsc would hang the whole runner.
      { encoding: "utf-8", timeout: 90000 },
    );

    assert.equal(
      result.status,
      0,
      result.error ? String(result.error) : result.stdout || result.stderr,
    );
  });
});

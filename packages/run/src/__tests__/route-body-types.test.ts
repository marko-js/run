import assert from "assert";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import url from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("Route body types", () => {
  // The package tsconfig excludes `__tests__`, so the assertions in
  // `types/route-body.ts` only mean something if something compiles them.
  it("should hold the compile-time assertions", function () {
    this.timeout(60000);
    const result = spawnSync(
      process.execPath,
      [
        require.resolve("typescript/lib/tsc.js"),
        "-p",
        path.join(__dirname, "types"),
        "--pretty",
        "false",
      ],
      { encoding: "utf-8" },
    );

    assert.equal(result.status, 0, result.stdout || result.stderr);
  });
});

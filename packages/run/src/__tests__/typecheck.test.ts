import assert from "assert";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import url from "url";

import type { Context, Route, RouteDef } from "../runtime/types";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

// The runtime only creates a body thenable for POST/PUT/PATCH requests with a
// configured validator, so a bodyless verb's `body` — reached as
// `$global.body` or `GetContext(...).body` — must read `undefined` rather
// than inviting dead `await` handling. The fully generic `Route` keeps the
// hedge, since a generic context (`ctx.parent`) may belong to a bodied route.
export type Cases = [
  Expect<Equal<Route<RouteDef<"/x", "GET">>["body"], undefined>>,
  Expect<Equal<Route<RouteDef<"/x", "HEAD">>["body"], undefined>>,
  Expect<
    Equal<Route<RouteDef<"/x", "POST">>["body"], undefined | Promise<unknown>>
  >,
  Expect<Equal<Route["body"], undefined | Promise<unknown>>>,
  Expect<Equal<Context<Route<RouteDef<"/x", "GET">>>["body"], undefined>>,
];

describe("test sources type-check", () => {
  // The package build excludes `__tests__`, so this compile is what makes
  // the suite's tests — the assertions above included — hold together as
  // TypeScript.
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

describe("route type generation type-checks", () => {
  // The fixture's middleware and handler each need the other's inferred
  // module type — the shape that collapses both to `any` (TS7022). Its
  // `@ts-expect-error` probes make silent widening fail this compile too.
  it("keeps middleware and validator types across the module cycle", function () {
    this.timeout(120000);
    const result = spawnSync(
      process.execPath,
      [
        require.resolve("typescript/lib/tsc.js"),
        "-p",
        path.join(
          __dirname,
          "fixtures",
          "params-validator-types",
          "tsconfig.check.json",
        ),
        "--pretty",
        "false",
      ],
      { encoding: "utf-8", timeout: 90000 },
    );

    const localErrors = (result.stdout || "")
      .split("\n")
      // The compile pulls in the whole workspace graph, which carries known
      // declaration-level noise; only errors in the fixture's sources are
      // the reproduction.
      .filter((line) => /params-validator-types[/\\]src[/\\]/.test(line));

    assert.deepEqual(localErrors, []);
  });
});

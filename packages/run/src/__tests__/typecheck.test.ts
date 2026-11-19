import assert from "assert";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import url from "url";

import type {
  Context,
  LayoutInput,
  Route,
  RouteDef,
  Template,
} from "../runtime/types";

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
  // A layout takes its body by the API it is written in: a class API
  // template has its `Component`, and an older one exports its `"~api"`.
  Expect<
    Equal<
      Layout<{ default: Marko.Template<object> & { Component: unknown } }>,
      { renderBody: Marko.Body }
    >
  >,
  Expect<
    Equal<Layout<{ default: Marko.Template<object> }>, { content: Marko.Body }>
  >,
  Expect<
    Equal<
      Layout<{ default: Marko.Template<object>; "~api": "class" }>,
      { renderBody: Marko.Body }
    >
  >,
  Expect<
    Equal<
      Layout<{ default: { Component: unknown }; "~api": "tags" }>,
      { content: Marko.Body }
    >
  >,
  // An untyped template takes the installed runtime's (Marko 5 here).
  Expect<Equal<Layout<any>, { renderBody: Marko.Body }>>,
  Expect<Equal<Layout<{ default: any }>, { renderBody: Marko.Body }>>,
];
type Layout<Module> = LayoutInput<Template<"L1", Module>>;

describe("test sources type-check", () => {
  // The package build excludes `__tests__`, so this compile is what makes
  // the suite's tests — the assertions above included — hold together as
  // TypeScript.
  it("should type-check the test sources", function () {
    this.timeout(120000);
    const result = tsc(path.join(__dirname, "..", ".."), "tsconfig.test.json");

    assert.equal(
      result.status,
      0,
      result.error ? String(result.error) : result.stdout || result.stderr,
    );
  });

  // Guards the generated `.marko-run/routes.d.ts` against handlers that call
  // `Run.href` with options in their own return value.
  it("should type-check the href-search-options fixture", function () {
    this.timeout(120000);
    const result = tsc(
      path.join(__dirname, "fixtures", "href-search-options"),
      "tsconfig.json",
    );
    // Package sources report known TS2344 errors against a concrete app
    // (see agent-feedback/bugs.md), so only fixture files count.
    const fixtureErrors = result.stdout
      .split("\n")
      .filter((line) => /^(src|\.marko-run)\/.*error TS/.test(line));

    assert.ok(!result.error, String(result.error));
    assert.deepEqual(fixtureErrors, []);
  });
});

function tsc(cwd: string, project: string) {
  return spawnSync(
    process.execPath,
    [
      require.resolve("typescript/lib/tsc.js"),
      "-p",
      project,
      "--pretty",
      "false",
    ],
    // Bounded here because mocha's timeout cannot interrupt a synchronous
    // spawn — a hung tsc would hang the whole runner.
    { cwd, encoding: "utf-8", timeout: 90000 },
  );
}

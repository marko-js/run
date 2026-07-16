import assert from "assert";

import { renderRouteTemplate } from "../codegen";
import type { Route } from "../types";

const route = {
  key: "/",
  index: 3,
  layouts: [],
  page: {
    filePath: "/app/src/routes/+page.marko",
  },
  templateFilePath: "/app/.marko-run/index/route.marko",
} as unknown as Route;

// Marko writes the possession token under a key named by its own
// debug/optimize mode (".have" debug, ".h" optimized), independent of Vite's
// dev/build mode. The generated accessor must find it either way.
describe("persisted codegen possession accessor", () => {
  for (const dev of [false, true]) {
    it(`reads the token under either runtime key (dev: ${dev})`, () => {
      const source = renderRouteTemplate(route, undefined, dev, true);
      const accessorSource = /^\s*(\(\) => self\[.+?),?$/m.exec(source)?.[1];
      assert.ok(accessorSource, `no accessor emitted in:\n${source}`);
      const read = (self: unknown): unknown =>
        new Function("self", `return (${accessorSource})();`)(self);

      assert.equal(
        read({ M: { _: { h: "optimized-token" } } }),
        "optimized-token",
      );
      assert.equal(read({ M: { _: { have: "debug-token" } } }), "debug-token");
      assert.equal(read({ M: { _: {} } }), undefined);
    });
  }

  it("keys the accessor by the configured runtimeId", () => {
    const source = renderRouteTemplate(route, undefined, false, true, "MR");
    assert.ok(source.includes(`self["MR"]._.h ?? self["MR"]._.have`), source);
  });
});

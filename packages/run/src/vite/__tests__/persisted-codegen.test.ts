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

describe("persisted codegen bootstrap", () => {
  it("registers persisted navigation with the route index and build id", () => {
    const source = renderRouteTemplate(route, undefined, false, true);
    assert.ok(source.includes("__run_persisted_register("), source);
    assert.ok(source.includes("\n    3,"), source);
    assert.ok(source.includes("__run_persisted_build_id()"), source);
  });

  it("omits the bootstrap for non-persisted routes", () => {
    const source = renderRouteTemplate(route, undefined, false, false);
    assert.ok(!source.includes("__run_persisted_register"), source);
  });
});

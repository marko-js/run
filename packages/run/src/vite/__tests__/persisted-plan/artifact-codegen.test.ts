import assert from "assert";

import { renderRoutesClient, type RoutesClientArtifacts } from "../../codegen";
import type { BuiltRoutes, Route } from "../../types";

function routes(): BuiltRoutes {
  return {
    list: [
      {
        index: 3,
        page: { filePath: "/app/src/routes/+page.marko" },
        templateFilePath: "/app/.marko-run/index/route.marko",
        path: { segments: [] },
      } as unknown as Route,
    ],
  } as unknown as BuiltRoutes;
}

const artifacts: RoutesClientArtifacts = {
  routes: [
    {
      routeIndex: 3,
      primaryArtifactIndex: 0,
      primaryRegistryIndex: 0,
      possessionShellIndexes: [0],
    },
  ],
  artifacts: ["virtual:marko-run/a/0"],
  capability: {
    shellIds: ["s:shared"],
    artifacts: [[0, 0]],
  },
};

describe("persisted-plan artifact route codegen (C2)", () => {
  it("C2-Seal1/C2-SealBytes: inactive emission is byte-identical to the pre-C2 route source", () => {
    const expected =
      'const routes = [\n\t[3, () => import(".marko-run/index/route.marko?persisted"), /^\\/$/],\n];\nexport default (pathname) => routes.find((route) => route[2].test(pathname));\n';
    assert.equal(renderRoutesClient(routes(), "/app"), expected);
  });

  it("C2-Meta2/C2-Meta3: active source structurally exports capability and thin possession metadata", () => {
    const source = renderRoutesClient(routes(), "/app", artifacts);
    assert.match(source, /export const capability = /);
    assert.match(source, /export const artifactRegistry = /);
    assert.match(source, /"s:shared"/);
    assert.match(source, /virtual:marko-run\/a\/0/);
    assert.doesNotMatch(source, /virtual:marko-run\/artifact\/a_0123456789ab/);
    assert.match(source, /"artifacts":\[\[0,0\]\]/);
    assert.doesNotMatch(source, /\?persisted/);
  });

  it("C2-Run1/C2-Bud1': each route has one indexed dynamic artifact import and no bootstrap or per-cell waterfall", () => {
    const source = renderRoutesClient(routes(), "/app", artifacts);
    assert.equal(source.match(/\(\)\s*=>\s*import\(/g)?.length, 1);
    assert.match(source, /artifactRegistry\[i\]/);
    assert.doesNotMatch(source, /virtual:marko-run\/route\//);
    assert.doesNotMatch(source, /\.map\([^)]*import|Promise\.all/);
  });

  it("C2-Seal5: route artifact generation is generation-complete or fails instead of mixing fallback entries", () => {
    assert.throws(
      () =>
        renderRoutesClient(routes(), "/app", {
          routes: [],
          artifacts: artifacts.artifacts,
          capability: artifacts.capability,
        }),
      /@marko\/run: route emission is incomplete for route 3/,
    );
  });
});

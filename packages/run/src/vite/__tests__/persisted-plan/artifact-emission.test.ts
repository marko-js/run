import assert from "assert";
import fs from "fs";
import path from "path";

import {
  type ArtifactEmission,
  emitPartitionArtifacts,
  EmitRejection,
} from "../../persisted-plan/artifact-emission";
import { createPersistedPlanHost } from "../../persisted-plan/coordinator";
import type { FinalizedPlan } from "../../persisted-plan/finalized-plan";
import { computePartition } from "../../persisted-plan/partition";
import {
  APP_ENTRY,
  compiledFixture,
  compileFixture,
} from "./utils/frozen-marko";
import { MockViteResolver } from "./utils/mock-resolver";

interface PlanOptions {
  statements?: FinalizedPlan["statements"];
  symbols?: FinalizedPlan["symbols"];
  requests?: FinalizedPlan["requestedModules"];
  exports?: FinalizedPlan["exports"];
  loaders?: FinalizedPlan["loaders"];
  capability?: string[];
  claimable?: string[];
}

function plan(moduleKey: string, opts: PlanOptions = {}): FinalizedPlan {
  return {
    schemaVersion: "finalized-plan@1",
    moduleKey,
    importer: moduleKey,
    originFile: moduleKey,
    fingerprintFields: {},
    statements: opts.statements ?? [],
    symbols: opts.symbols ?? {},
    requestedModules: opts.requests ?? [],
    exports: opts.exports ?? [],
    loaders: opts.loaders ?? [],
    moduleStateLinks: [],
    eagerCandidates: [],
    shellCapability: {
      shells: (opts.capability ?? []).map((shellId) => ({
        shellId,
        templateSym: `%template:${shellId}`,
        walksSym: `%walks:${shellId}`,
      })),
    },
    shellPossession: {
      claimable: opts.claimable ?? [],
      deferred: [],
    },
    resolutionDeps: [],
    resolverConfigTag: "",
    fingerprint: `fp:${moduleKey}:${JSON.stringify(opts)}`,
  };
}

function stmt(
  ordinal: number,
  kind: FinalizedPlan["statements"][number]["kind"],
  text: string,
  spans: [number, number, string][] = [],
): FinalizedPlan["statements"][number] {
  return {
    ordinal,
    evalOrdinal: ordinal,
    kind,
    text,
    nodeOffset: 0,
    ...(kind === "export-decl" || kind === "export-default"
      ? { innerOffset: text.indexOf(" ") + 1 }
      : null),
    spans,
    comments: { leading: [], internal: [], trailing: [] },
    origin: { file: "fixture.js", line: ordinal + 1, column: 0 },
  };
}

function request(
  canonical: string,
  ordinal: number,
  kind: FinalizedPlan["requestedModules"][number]["kind"] = "external",
): FinalizedPlan["requestedModules"][number] {
  return {
    specifier: canonical,
    canonical,
    attributes: [],
    kind,
    form: "import",
    bare: true,
    ordinal,
    firstOccurrence: true,
    plainTemplate: false,
    span: { start: 7, end: 7 + JSON.stringify(canonical).length },
  };
}

function emit(
  plans: FinalizedPlan[],
  routes: { routeIndex: number; entryModuleKey: string }[],
  ordinaryVirtualSources?: ReadonlyMap<string, string>,
): ArtifactEmission {
  const partition = computePartition({
    plans,
    routes,
    publicationToken: { epoch: 1, configEpoch: "c2" },
  });
  return emitPartitionArtifacts(partition, plans, ordinaryVirtualSources);
}

describe("persisted-plan per-cell artifact emission (C2)", () => {
  it("C2-Emit1: shared emission units still reject a retained external first requested after an internalized body event", () => {
    const child = plan("child", {
      statements: [stmt(0, "stmt", "globalThis.child = true;")],
    });
    const root = plan("root", {
      statements: [
        stmt(0, "import", 'import "./child";'),
        stmt(1, "import", 'import "late";'),
      ],
      requests: [request("child", 0, "internalized-child"), request("late", 1)],
    });
    const wrapper = (index: number) =>
      plan(`wrapper:${index}`, {
        requests: [request("root", 0, "internalized-child")],
      });
    assert.throws(
      () =>
        emit(
          [wrapper(0), wrapper(1), root, child],
          [
            { routeIndex: 0, entryModuleKey: "wrapper:0" },
            { routeIndex: 1, entryModuleKey: "wrapper:1" },
          ],
        ),
      (error: Error) =>
        error instanceof EmitRejection &&
        error.code === "late-external-after-body" &&
        error.module === "root" &&
        error.ordinal === 1 &&
        error.canonical === "late",
    );
  });

  it("C2-Emit1'/C2-Layout1: route-private wrapper and page emit separately while a late shared layout remains a peer import", () => {
    const layout = plan("layout", {
      statements: [stmt(0, "stmt", "globalThis.layout = true;")],
    });
    const page0 = plan("page:0", {
      statements: [stmt(0, "stmt", "globalThis.page = 0;")],
    });
    const page1 = plan("page:1", {
      statements: [stmt(0, "stmt", "globalThis.page = 1;")],
    });
    const wrapper = (index: number) =>
      plan(`wrapper:${index}`, {
        statements: [
          stmt(0, "import", `import "./page:${index}";`),
          stmt(1, "import", 'import "./layout";'),
        ],
        requests: [
          request(`page:${index}`, 0, "internalized-child"),
          request("layout", 1, "internalized-child"),
        ],
      });
    const result = emit(
      [wrapper(0), page0, wrapper(1), page1, layout],
      [
        { routeIndex: 0, entryModuleKey: "wrapper:0" },
        { routeIndex: 1, entryModuleKey: "wrapper:1" },
      ],
    );
    const wrapperArtifact = result.artifacts.find(
      (artifact) => artifact.rootModuleKey === "wrapper:0",
    )!;
    const pageArtifact = result.artifacts.find(
      (artifact) => artifact.rootModuleKey === "page:0",
    )!;
    const layoutArtifacts = result.artifacts.filter((artifact) =>
      artifact.moduleKeys.includes("layout"),
    );
    assert.deepEqual(wrapperArtifact.moduleKeys, ["wrapper:0"]);
    assert.deepEqual(pageArtifact.moduleKeys, ["page:0"]);
    assert.equal(layoutArtifacts.length, 1);
    assert.match(wrapperArtifact.source, /virtual:marko-run\/artifact\//);
  });

  it("C2-Layout1/C2-Dedup1: disconnected modules with the same shared incidence remain one merged artifact", () => {
    const layout = plan("layout", {
      statements: [stmt(0, "stmt", "globalThis.layout = true;")],
    });
    const tag = plan("tag", {
      statements: [stmt(0, "stmt", "globalThis.tag = true;")],
    });
    const wrapper = (index: number) =>
      plan(`wrapper:${index}`, {
        requests: [
          request("layout", 0, "internalized-child"),
          request("tag", 1, "internalized-child"),
        ],
      });
    const result = emit(
      [wrapper(0), wrapper(1), layout, tag],
      [
        { routeIndex: 0, entryModuleKey: "wrapper:0" },
        { routeIndex: 1, entryModuleKey: "wrapper:1" },
      ],
    );
    const shared = result.artifacts.filter(
      (artifact) =>
        artifact.moduleKeys.includes("layout") ||
        artifact.moduleKeys.includes("tag"),
    );
    assert.equal(shared.length, 1);
    assert.deepEqual(shared[0].moduleKeys.sort(), ["layout", "tag"]);
    assert.match(shared[0].source, /globalThis\.layout = true/);
    assert.match(shared[0].source, /globalThis\.tag = true/);
  });

  it("C2-Emit3/C2-Bud3: merged roots preserve pure annotations on rewritten default exports", () => {
    const pureDefault = plan("shared:pure", {
      statements: [
        {
          ...stmt(0, "export-default", "export default /*@__PURE__*/make();"),
          innerOffset: "export default /*@__PURE__*/".length,
        },
      ],
      exports: [
        {
          exported: "default",
          ordinal: 0,
          target: { kind: "default-expr", ordinal: 0 },
        },
      ],
    });
    const sharedPeer = plan("shared:peer", {
      statements: [stmt(0, "stmt", "globalThis.peer = true;")],
    });
    const wrapper = (index: number) =>
      plan(`wrapper:${index}`, {
        requests: [
          request("shared:pure", 0, "internalized-child"),
          request("shared:peer", 1, "internalized-child"),
        ],
      });
    const result = emit(
      [wrapper(0), wrapper(1), pureDefault, sharedPeer],
      [
        { routeIndex: 0, entryModuleKey: "wrapper:0" },
        { routeIndex: 1, entryModuleKey: "wrapper:1" },
      ],
    );
    const shared = result.artifacts.find((artifact) =>
      artifact.moduleKeys.includes("shared:pure"),
    )!;
    assert.match(
      shared.source,
      /const \$default = \s*\/\*@__PURE__\*\/make\(\)/,
    );
  });

  it("C2-Emit3/C2-Dedup1: a peer import of a merged child uses its collision-safe facade", () => {
    const child = plan("shared-child", {
      statements: [
        stmt(0, "export-decl", "export const value = 1;", [[13, 18, "%value"]]),
      ],
      symbols: {
        "%value": {
          name: "value",
          kind: "local",
          declKind: "const",
          refCount: 1,
          declOrdinal: 0,
        },
      },
      exports: [
        {
          exported: "value",
          ordinal: 0,
          target: { kind: "local", symId: "%value" },
        },
      ],
    });
    const sharedRoot = plan("shared-root", {
      statements: [stmt(0, "import", 'import "./shared-child";')],
      requests: [request("shared-child", 0, "internalized-child")],
    });
    const consumer = plan("consumer", {
      statements: [
        stmt(0, "import", 'import { value } from "./shared-child";'),
        stmt(1, "stmt", "globalThis.peer = value;", [[18, 23, "%value"]]),
      ],
      symbols: {
        "%value": {
          name: "value",
          kind: "import",
          declKind: "module",
          refCount: 1,
          declOrdinal: 0,
          import: {
            specifier: "./shared-child",
            canonical: "shared-child",
            imported: "value",
            attributes: [],
          },
        },
      },
      requests: [request("shared-child", 0)],
    });
    const wrapper = (index: number) =>
      plan(`wrapper:${index}`, {
        requests: [
          request("shared-root", 0, "internalized-child"),
          ...(index === 0
            ? [request("consumer", 1, "internalized-child")]
            : []),
        ],
      });
    const result = emit(
      [wrapper(0), wrapper(1), sharedRoot, child, consumer],
      [
        { routeIndex: 0, entryModuleKey: "wrapper:0" },
        { routeIndex: 1, entryModuleKey: "wrapper:1" },
      ],
    );
    const facade = result.facades.find(
      (candidate) => candidate.moduleKey === "shared-child",
    )!;
    const shared = result.artifacts.find((artifact) =>
      artifact.moduleKeys.includes("shared-child"),
    )!;
    const consumerArtifact = result.artifacts.find((artifact) =>
      artifact.moduleKeys.includes("consumer"),
    )!;
    assert.ok(facade);
    assert.match(facade.source, /as value/);
    assert.match(shared.source, /as __c2_/);
    assert.match(
      consumerArtifact.source,
      new RegExp(facade.virtualId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  it("C2-Emit1: allows root-early external followed by a child external and a late duplicate", () => {
    const child = plan("child", {
      statements: [stmt(0, "import", 'import "early";')],
      requests: [request("early", 0)],
    });
    const root = plan("root", {
      statements: [
        stmt(0, "import", 'import "early";'),
        stmt(1, "import", 'import "./child";'),
        stmt(2, "import", 'import "early";'),
      ],
      requests: [
        request("early", 0),
        request("child", 1, "internalized-child"),
        { ...request("early", 2), firstOccurrence: false },
      ],
    });
    const result = emit(
      [root, child],
      [{ routeIndex: 0, entryModuleKey: "root" }],
    );
    assert.equal(result.artifacts.length, 2);
    assert.equal(
      result.artifacts.find((artifact) => artifact.rootModuleKey === "root")!
        .manifest.imports.length,
      2,
    );
  });

  it("C2-Emit2: rejects circular re-export resolution", () => {
    const a = plan("a", {
      statements: [stmt(0, "import", 'import { x } from "./b";')],
      symbols: {
        "%x": {
          name: "x",
          kind: "import",
          declKind: "module",
          refCount: 1,
          declOrdinal: 0,
          import: {
            specifier: "./b",
            canonical: "b",
            imported: "x",
            attributes: [],
          },
        },
      },
      requests: [request("b", 0, "internalized-child")],
      exports: [
        {
          exported: "x",
          ordinal: 0,
          target: {
            kind: "external",
            specifier: "./b",
            canonical: "b",
            imported: "x",
            attributes: [],
          },
        },
      ],
    });
    const b = plan("b", {
      statements: [stmt(0, "import", 'import { x } from "./a";')],
      symbols: {
        "%x": {
          name: "x",
          kind: "import",
          declKind: "module",
          refCount: 1,
          declOrdinal: 0,
          import: {
            specifier: "./a",
            canonical: "a",
            imported: "x",
            attributes: [],
          },
        },
      },
      requests: [request("a", 0, "internalized-child")],
      exports: [
        {
          exported: "x",
          ordinal: 0,
          target: {
            kind: "external",
            specifier: "./a",
            canonical: "a",
            imported: "x",
            attributes: [],
          },
        },
      ],
    });
    const wrapper = (index: number) =>
      plan(`wrapper:${index}`, {
        requests: [request("a", 0, "internalized-child")],
      });
    assert.throws(
      () =>
        emit(
          [wrapper(0), wrapper(1), a, b],
          [
            { routeIndex: 0, entryModuleKey: "wrapper:0" },
            { routeIndex: 1, entryModuleKey: "wrapper:1" },
          ],
        ),
      (error: Error) =>
        error instanceof EmitRejection && error.code === "circular-reexport",
    );
  });

  it("C2-Emit3/C2-Emit7: merges canonical statement text and preserves the route root exports", () => {
    const childText = "const answer = 41;";
    const child = plan("child", {
      statements: [
        stmt(0, "export-decl", `export ${childText}`, [[6, 12, "%answer"]]),
      ],
      symbols: {
        "%answer": {
          name: "answer",
          kind: "local",
          declKind: "const",
          refCount: 1,
          declOrdinal: 0,
        },
      },
      exports: [
        {
          exported: "answer",
          ordinal: 0,
          target: { kind: "local", symId: "%answer" },
        },
      ],
    });
    const rootText = "export const patch = answer + 1;";
    const root = plan("root", {
      statements: [
        stmt(0, "import", 'import { answer } from "./child";'),
        stmt(1, "export-decl", rootText, [
          [13, 18, "%patch"],
          [21, 27, "%answer"],
        ]),
      ],
      symbols: {
        "%answer": {
          name: "answer",
          kind: "import",
          declKind: "module",
          refCount: 1,
          declOrdinal: 0,
          import: {
            specifier: "./child",
            canonical: "child",
            imported: "answer",
            attributes: [],
          },
        },
        "%patch": {
          name: "patch",
          kind: "local",
          declKind: "const",
          refCount: 0,
          declOrdinal: 1,
        },
      },
      requests: [request("child", 0, "internalized-child")],
      exports: [
        {
          exported: "patch",
          ordinal: 1,
          target: { kind: "local", symId: "%patch" },
        },
      ],
    });
    const wrapper = (index: number) =>
      plan(`wrapper:${index}`, {
        requests: [request("root", 0, "internalized-child")],
      });
    const result = emit(
      [wrapper(0), wrapper(1), root, child],
      [
        { routeIndex: 0, entryModuleKey: "wrapper:0" },
        { routeIndex: 1, entryModuleKey: "wrapper:1" },
      ],
    );
    const source = result.artifacts.find(
      (artifact) => artifact.rootModuleKey === "root",
    )!.source;
    assert.match(source, /const answer = 41;/);
    assert.match(source, /export const patch = answer \+ 1;/);
    assert.doesNotMatch(source, /import \{ answer \}/);
  });

  it("C2-Emit3: reattaches relative imports with resolver-issued canonical ids", () => {
    const root = plan("root", {
      statements: [stmt(0, "import", 'import value from "./dep.js";')],
      symbols: {
        "%value": {
          name: "value",
          kind: "import",
          declKind: "module",
          refCount: 1,
          declOrdinal: 0,
          import: {
            specifier: "./dep.js",
            canonical: "/canonical/dep.js",
            imported: "default",
            attributes: [],
          },
        },
      },
      requests: [
        {
          ...request("./dep.js", 0),
          canonical: "/canonical/dep.js",
          bare: false,
        },
      ],
    });
    const result = emit([root], [{ routeIndex: 0, entryModuleKey: "root" }]);
    assert.match(result.artifacts[0].source, /"\/canonical\/dep\.js"/);
    assert.doesNotMatch(result.artifacts[0].source, /"\.\/dep\.js"/);
  });

  it("C2-Emit4/C2-Emit5: reattaches ordinary relative dynamic imports from a virtual artifact", () => {
    const specifier = "./related.marko";
    const canonical = "/canonical/related.marko";
    const root = plan("root", {
      statements: [stmt(0, "stmt", `import(${JSON.stringify(specifier)});`)],
      requests: [
        {
          ...request(canonical, 0),
          specifier,
          form: "dynamic-import",
          span: { start: 7, end: 7 + JSON.stringify(specifier).length },
        },
      ],
    });
    const result = emit([root], [{ routeIndex: 0, entryModuleKey: "root" }]);
    assert.match(result.artifacts[0].source, /"\/canonical\/related\.marko"/);
    assert.doesNotMatch(result.artifacts[0].source, /"\.\/related\.marko"/);
  });

  it("C2-Emit4/C2-Emit5/C2-SpecG: remaps demand targets to exactly one lazy artifact and emits zero ?persisted", () => {
    const lazy = plan("lazy?persisted", {
      statements: [stmt(0, "stmt", "globalThis.lazyLoaded = true;")],
      capability: ["shell:lazy"],
      claimable: ["shell:lazy"],
    });
    const root = plan("root?persisted", {
      statements: [
        stmt(0, "stmt", 'const load = () => import("./lazy?persisted");'),
      ],
      requests: [
        {
          ...request("lazy?persisted", 0, "lazy-edge"),
          specifier: "./lazy?persisted",
          form: "dynamic-import",
          span: { start: 26, end: 44 },
        },
      ],
      loaders: [
        {
          targetKind: "escaped-direct",
          registryFn: "_update_loader",
          rendererId: "lazy",
          targets: [
            {
              specifier: "./lazy?persisted",
              canonical: "lazy?persisted",
            },
          ],
          ordinal: 0,
          firstWins: true,
        },
      ],
    });
    const result = emit(
      [root, lazy],
      [{ routeIndex: 0, entryModuleKey: "root?persisted" }],
    );
    assert.equal(result.lazyArtifacts.length, 1);
    assert.equal(result.lazyArtifacts[0].rootModuleKey, "lazy?persisted");
    for (const artifact of result.artifacts) {
      assert.doesNotMatch(artifact.source, /\?persisted/);
    }
    // C3 cutover: print-skip dual-entry stubs side-effect-import this map.
    assert.equal(
      result.mergeVirtualByModuleKey["lazy?persisted"],
      result.lazyArtifacts[0].virtualId,
    );
    assert.equal(
      result.mergeVirtualByModuleKey["root?persisted"],
      result.artifacts.find((a) => a.rootModuleKey === "root?persisted")
        ?.virtualId,
    );
  });

  it("C2-LazyMap1/C2-Emit5': plan-backed demand outside the lazy map and eager cell fails the seal", () => {
    const lazy = plan("lazy", {
      statements: [stmt(0, "stmt", "globalThis.lazyLoaded = true;")],
    });
    const root = plan("root", {
      statements: [stmt(0, "stmt", 'const load = () => import("./lazy");')],
      requests: [
        {
          ...request("lazy", 0, "lazy-edge"),
          specifier: "./lazy",
          form: "dynamic-import",
          span: { start: 26, end: 34 },
        },
      ],
      loaders: [
        {
          targetKind: "escaped-direct",
          registryFn: "_update_loader",
          rendererId: "lazy",
          targets: [{ specifier: "./lazy", canonical: "lazy" }],
          ordinal: 0,
          firstWins: true,
        },
      ],
    });
    const plans = [root, lazy];
    const partition = computePartition({
      plans,
      routes: [{ routeIndex: 0, entryModuleKey: "root" }],
      publicationToken: { epoch: 1, configEpoch: "test" },
    });
    assert.throws(
      () =>
        emitPartitionArtifacts({ ...partition, lazyRootCellIds: {} }, plans),
      /@marko\/run: demand seal.*root.*lazy/,
    );
  });

  it("C2-LazyMap1'/C2-Emit5': plan-less Marko virtual demand uses a deterministic host passthrough", () => {
    const canonical = "/app/tags/spec.marko-virtual.input_value.js";
    const source = 'export { value as _ } from "./spec.marko";';
    const root = plan("/app/root.js", {
      statements: [
        stmt(
          0,
          "stmt",
          'const load = () => import("./tags/spec.marko-virtual.input_value.js");',
        ),
      ],
    });
    const sources = new Map([[canonical, source]]);
    const first = emit(
      [root],
      [{ routeIndex: 0, entryModuleKey: "/app/root.js" }],
      sources,
    );
    const second = emit(
      [root],
      [{ routeIndex: 0, entryModuleKey: "/app/root.js" }],
      sources,
    );
    assert.equal(first.passthroughs.length, 1);
    assert.equal(first.passthroughs[0].canonical, canonical);
    assert.equal(first.passthroughs[0].source, source);
    assert.match(
      first.passthroughs[0].virtualId,
      /^virtual:marko-run\/ordinary\/o_[0-9a-f]{12}$/,
    );
    assert.equal(
      first.passthroughs[0].virtualId,
      second.passthroughs[0].virtualId,
    );
    assert.match(
      first.artifacts[0].source,
      new RegExp(first.passthroughs[0].virtualId),
    );
  });

  it("C2-LazyMap1'/C2-Emit5': residual virtual demand fails closed with module and canonical", () => {
    const canonical = "/app/tags/missing.marko-virtual.input_value.js";
    const root = plan("root", {
      statements: [
        stmt(0, "stmt", 'const load = () => import("./signal.js");'),
      ],
      requests: [
        {
          ...request(canonical, 0, "lazy-edge"),
          specifier: "./signal.js",
          form: "dynamic-import",
          span: { start: 26, end: 39 },
        },
      ],
    });
    assert.throws(
      () => emit([root], [{ routeIndex: 0, entryModuleKey: "root" }]),
      /@marko\/run: residual dynamic import.*root.*missing\.marko-virtual\.input_value\.js/,
    );
  });

  it("C2-Emit6/C2-Det1/C2-Det2/C2-Seal3: cold emission and token-only rebind are byte-identical and sorted", () => {
    const plans = [
      plan("route:b", { statements: [stmt(0, "stmt", "const b = 2;")] }),
      plan("route:a", { statements: [stmt(0, "stmt", "const a = 1;")] }),
    ];
    const routes = [
      { routeIndex: 1, entryModuleKey: "route:b" },
      { routeIndex: 0, entryModuleKey: "route:a" },
    ];
    const partition = computePartition({
      plans,
      routes,
      publicationToken: { epoch: 1, configEpoch: "a" },
    });
    const rebound = {
      ...partition,
      publicationToken: { epoch: 2, configEpoch: "b" },
    };
    const a = emitPartitionArtifacts(partition, [...plans].reverse());
    const b = emitPartitionArtifacts(rebound, plans);
    assert.deepEqual(
      a.artifacts.map(({ publicId, source }) => [publicId, source]),
      b.artifacts.map(({ publicId, source }) => [publicId, source]),
    );
    assert.deepEqual(
      a.artifacts.map(({ cellId }) => cellId),
      [...a.artifacts.map(({ cellId }) => cellId)].sort(),
    );
    for (const artifact of a.artifacts) {
      assert.match(artifact.publicId, /^a_[0-9a-f]{12}$/);
    }
  });

  it("C2-Seal4: body fingerprint movement changes the public artifact id", () => {
    const before = emit(
      [plan("root", { statements: [stmt(0, "stmt", "const x = 1;")] })],
      [{ routeIndex: 0, entryModuleKey: "root" }],
    );
    const after = emit(
      [plan("root", { statements: [stmt(0, "stmt", "const x = 2;")] })],
      [{ routeIndex: 0, entryModuleKey: "root" }],
    );
    assert.notEqual(before.artifacts[0].publicId, after.artifacts[0].publicId);
  });

  it("C2-Dedup1/C2-Dedup2/C2-SpecB: shared cell and capability are emitted once across routes", () => {
    const shared = plan("shared", {
      statements: [stmt(0, "stmt", "globalThis.shared = true;")],
      capability: ["shell:shared"],
      claimable: ["shell:shared"],
    });
    const pages = Array.from({ length: 10 }, (_, index) =>
      plan(`route:${index}`, {
        statements: [
          stmt(0, "import", 'import "./shared";'),
          stmt(1, "stmt", `globalThis.route = ${index};`),
        ],
        requests: [request("shared", 0, "internalized-child")],
        claimable: [`shell:route:${index}`],
      }),
    );
    const result = emit(
      [...pages, shared],
      pages.map((page, routeIndex) => ({
        routeIndex,
        entryModuleKey: page.moduleKey,
      })),
    );
    const sharedArtifacts = result.artifacts.filter((artifact) =>
      artifact.moduleKeys.includes("shared"),
    );
    assert.equal(sharedArtifacts.length, 1);
    assert.deepEqual(sharedArtifacts[0].capabilityShellIds, ["shell:shared"]);
    const sharedIndex = result.artifacts.indexOf(sharedArtifacts[0]);
    assert.deepEqual(
      result.capability.artifacts.find(
        ([artifactIndex]) => artifactIndex === sharedIndex,
      ),
      [sharedIndex, result.capability.shellIds.indexOf("shell:shared")],
    );
    assert.equal(
      result.capability.artifacts.some((row) => row.length < 2),
      false,
    );
  });

  it("C2-Dedup3: equal-incidence lazy targets remain distinct artifacts", () => {
    const lazyA = plan("lazy:a");
    const lazyB = plan("lazy:b");
    const root = plan("root", {
      statements: [stmt(0, "stmt", 'import("lazy:a"); import("lazy:b");')],
      requests: [
        {
          ...request("lazy:a", 0, "lazy-edge"),
          form: "dynamic-import",
          span: { start: 7, end: 15 },
        },
        {
          ...request("lazy:b", 0, "lazy-edge"),
          form: "dynamic-import",
          span: { start: 25, end: 33 },
        },
      ],
      loaders: [
        {
          targetKind: "escaped-direct",
          registryFn: "_update_loader",
          rendererId: "a",
          targets: [{ specifier: "lazy:a", canonical: "lazy:a" }],
          ordinal: 0,
          firstWins: true,
        },
        {
          targetKind: "escaped-direct",
          registryFn: "_update_loader",
          rendererId: "b",
          targets: [{ specifier: "lazy:b", canonical: "lazy:b" }],
          ordinal: 0,
          firstWins: true,
        },
      ],
    });
    const result = emit(
      [root, lazyA, lazyB],
      [{ routeIndex: 0, entryModuleKey: "root" }],
    );
    assert.equal(result.lazyArtifacts.length, 2);
    assert.notEqual(
      result.lazyArtifacts[0].publicId,
      result.lazyArtifacts[1].publicId,
    );
  });

  it("C2-Dedup4: brochure routes retain distinct route artifacts", () => {
    const pages = [plan("route:a"), plan("route:b")];
    const result = emit(pages, [
      { routeIndex: 0, entryModuleKey: "route:a" },
      { routeIndex: 1, entryModuleKey: "route:b" },
    ]);
    assert.equal(result.artifacts.length, 2);
    assert.equal(result.routes.length, 2);
  });

  it("C2-Orph1: empty-root cells emit no artifact", () => {
    const result = emit(
      [plan("route"), plan("orphan")],
      [{ routeIndex: 0, entryModuleKey: "route" }],
    );
    assert.equal(
      result.artifacts.some((artifact) =>
        artifact.moduleKeys.includes("orphan"),
      ),
      false,
    );
  });

  it("C2-Cap1/C2-Cap2/C2-Cap3: lazy capability ships globally but possession remains eager-only and fail-closed", () => {
    const lazy = plan("lazy", {
      capability: ["shell:lazy"],
      claimable: ["shell:lazy"],
    });
    const root = plan("root", {
      requests: [
        {
          ...request("lazy", 0, "lazy-edge"),
          form: "dynamic-import",
        },
      ],
      loaders: [
        {
          targetKind: "escaped-direct",
          registryFn: "_update_loader",
          rendererId: "lazy",
          targets: [{ specifier: "lazy", canonical: "lazy" }],
          ordinal: 0,
          firstWins: true,
        },
      ],
    });
    const result = emit(
      [root, lazy],
      [{ routeIndex: 0, entryModuleKey: "root" }],
    );
    assert.ok(result.capability.shellIds.includes("shell:lazy"));
    assert.deepEqual(result.routes[0].possessionShellIndexes, []);
  });

  it("C2-Zleak: public client metadata contains no partition schema, token, fingerprint, or full cell ids", () => {
    const result = emit(
      [plan("root", { capability: ["shell:root"] })],
      [{ routeIndex: 0, entryModuleKey: "root" }],
    );
    const clientMetadata = JSON.stringify({
      capability: result.capability,
      routes: result.routes,
    });
    assert.doesNotMatch(
      clientMetadata,
      /partition-state@1|publicationToken|inputFingerprint|cell:\[/,
    );
  });

  it("C2-Emit4/C2-Emit7: the frozen real multi-module carrier emits through the production path", async function (this: Mocha.Context) {
    this.timeout(120_000);
    const compiled = await compiledFixture(APP_ENTRY);
    const host = createPersistedPlanHost();
    const normalizedVirtualSources = (
      entry: string,
      virtualSources: ReadonlyMap<string, string>,
    ) =>
      new Map(
        [...virtualSources].map(([canonical, source]) => [
          canonical.startsWith(".")
            ? path.resolve(path.dirname(entry), canonical)
            : canonical,
          source,
        ]),
      );
    const ordinaryVirtualSources = normalizedVirtualSources(
      APP_ENTRY,
      compiled.virtualSources,
    );
    const resolverFor = (
      entry: string,
      virtualSources: Map<string, string>,
    ) => {
      const resolver = new MockViteResolver({
        virtuals: Object.fromEntries(
          normalizedVirtualSources(entry, virtualSources),
        ),
      });
      return {
        resolveId(
          specifier: string,
          importer: string,
          attributes: FinalizedPlan["requestedModules"][number]["attributes"] = [],
        ) {
          let from = importer.split("?")[0];
          if (from.startsWith(".")) {
            from = path.join(entry, "..", from);
          }
          return resolver.resolveId(specifier, from, attributes);
        },
      };
    };
    await host.ensureFinalized({
      id: APP_ENTRY,
      env: "client",
      carrier: compiled.carrier,
      resolver: resolverFor(APP_ENTRY, compiled.virtualSources),
      selfPlainRaw: compiled.carrier?.entry.moduleStateLinks[0]?.specifier,
    });
    const tagDir = path.join(path.dirname(APP_ENTRY), "tags");
    for (const name of fs
      .readdirSync(tagDir)
      .filter((name) => name.endsWith(".marko"))) {
      const tagEntry = path.join(tagDir, name);
      const tag = await compileFixture(tagEntry);
      for (const [canonical, source] of normalizedVirtualSources(
        tagEntry,
        tag.virtualSources,
      )) {
        ordinaryVirtualSources.set(canonical, source);
      }
      await host.ensureFinalized({
        id: tagEntry,
        env: "client",
        carrier: tag.carrier,
        resolver: resolverFor(tagEntry, tag.virtualSources),
        selfPlainRaw: tag.carrier?.entry.moduleStateLinks[0]?.specifier,
      });
    }
    const partition = host.sealPartition(
      [{ routeIndex: 0, templateFilePath: APP_ENTRY }],
      "build",
    ).state!;
    const result = emitPartitionArtifacts(
      partition,
      host.snapshotCommitted("client").flatMap((set) => set.plans),
      ordinaryVirtualSources,
    );
    assert.ok(result.artifacts.length > 1);
    assert.ok(
      result.artifacts
        .filter((artifact) => artifact.cellId === result.artifacts[0].cellId)
        .every((artifact) => artifact.moduleKeys.length === 1),
    );
    assert.ok(result.lazyArtifacts.length);
    assert.ok(result.artifacts[0].source);
  });

  it("C3 ready remap: setup dynamic import becomes Promise.all(DOM, merge)", () => {
    const setupPath = "/app/widget.marko-virtual.setup.js";
    const mergePath = "/app/widget.marko?persisted";
    const importArg = JSON.stringify(setupPath);
    const setupText = `const load = () => import(${importArg});`;
    const argStart = setupText.indexOf(importArg);
    const setup = plan(setupPath, {
      statements: [stmt(0, "stmt", setupText)],
      requests: [
        {
          specifier: setupPath,
          canonical: setupPath,
          attributes: [],
          kind: "lazy-edge",
          form: "dynamic-import",
          bare: true,
          ordinal: 0,
          firstOccurrence: true,
          plainTemplate: false,
          span: { start: argStart, end: argStart + importArg.length },
        },
      ],
    });
    // Second route entry so merge gets its own publicId (lookup target).
    const merge = plan(mergePath, {
      statements: [stmt(0, "stmt", "globalThis.widgetMerge = true;")],
    });
    const root = plan("root", {
      statements: [
        stmt(
          0,
          "stmt",
          `const load = () => import(${JSON.stringify(setupPath)});`,
        ),
      ],
      requests: [
        {
          ...request(setupPath, 0, "lazy-edge"),
          form: "dynamic-import",
          specifier: setupPath,
          span: {
            start: 26,
            end: 26 + JSON.stringify(setupPath).length,
          },
        },
      ],
      loaders: [
        {
          targetKind: "escaped-direct",
          registryFn: "_update_loader",
          rendererId: "widget",
          targets: [{ specifier: setupPath, canonical: setupPath }],
          ordinal: 0,
          firstWins: true,
        },
      ],
    });
    const result = emit(
      [root, setup, merge],
      [
        { routeIndex: 0, entryModuleKey: "root" },
        { routeIndex: 1, entryModuleKey: mergePath },
      ],
    );
    const setupArtifact = result.lazyArtifacts.find((a) =>
      a.moduleKeys.includes(setupPath),
    );
    assert.ok(setupArtifact, "setup must emit as a lazy artifact");
    assert.match(
      setupArtifact!.source,
      /Promise\.all\(\[import\("\/app\/widget\.marko"\),import\("virtual:marko-run\/artifact\//,
    );
  });

  it("C3 ready remap: missing merge for setup hard-fails", () => {
    const setupPath = "/app/orphan.marko-virtual.setup.js";
    const importArg = JSON.stringify(setupPath);
    const setupText = `const load = () => import(${importArg});`;
    const argStart = setupText.indexOf(importArg);
    const setup = plan(setupPath, {
      statements: [stmt(0, "stmt", setupText)],
      requests: [
        {
          specifier: setupPath,
          canonical: setupPath,
          attributes: [],
          kind: "lazy-edge",
          form: "dynamic-import",
          bare: true,
          ordinal: 0,
          firstOccurrence: true,
          plainTemplate: false,
          span: { start: argStart, end: argStart + importArg.length },
        },
      ],
    });
    // Reachable lazy root with setup body, but no merge publicId exists.
    const root = plan("root", {
      statements: [
        stmt(
          0,
          "stmt",
          `const load = () => import(${JSON.stringify(setupPath)});`,
        ),
      ],
      requests: [
        {
          ...request(setupPath, 0, "lazy-edge"),
          form: "dynamic-import",
          specifier: setupPath,
          span: {
            start: 26,
            end: 26 + JSON.stringify(setupPath).length,
          },
        },
      ],
      loaders: [
        {
          targetKind: "escaped-direct",
          registryFn: "_update_loader",
          rendererId: "orphan",
          targets: [{ specifier: setupPath, canonical: setupPath }],
          ordinal: 0,
          firstWins: true,
        },
      ],
    });
    assert.throws(
      () => emit([root, setup], [{ routeIndex: 0, entryModuleKey: "root" }]),
      /@marko\/run: ready setup/,
    );
  });
});

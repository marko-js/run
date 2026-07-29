import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { brotliCompressSync } from "zlib";

import { renderRoutesClient } from "../../codegen";
import {
  CancelledError,
  createPersistedPlanHost,
  type PlanIntake,
} from "../../persisted-plan/coordinator";
import type { FinalizedPlan } from "../../persisted-plan/finalized-plan";
import {
  computePartition,
  type PartitionInput,
  type PartitionRoute,
  serializePartitionState,
} from "../../persisted-plan/partition";
import { PartitionStore } from "../../persisted-plan/partition-store";
import type { BuiltRoutes, Route } from "../../types";
import { APP_ENTRY, compiledFixture, SIMPLE_ENTRY } from "./utils/frozen-marko";
import { MockViteResolver } from "./utils/mock-resolver";

interface PlanOptions {
  fingerprint?: string;
  sync?: string[];
  lazy?: string[];
  demand?: string[];
  scheduled?: string[];
  capability?: string[];
  claimable?: string[];
  deferred?: string[];
}

function finalizedPlan(
  moduleKey: string,
  opts: PlanOptions = {},
): FinalizedPlan {
  const requestedModules = [
    ...(opts.sync ?? []).map((canonical, ordinal) => ({
      specifier: canonical,
      canonical,
      attributes: [],
      kind: "internalized-child" as const,
      form: "import" as const,
      bare: false,
      ordinal,
      firstOccurrence: true,
      plainTemplate: false,
      span: { start: 0, end: 0 },
    })),
    ...(opts.lazy ?? []).map((canonical, offset) => ({
      specifier: canonical,
      canonical,
      attributes: [],
      kind: "lazy-edge" as const,
      form: "dynamic-import" as const,
      bare: false,
      ordinal: (opts.sync?.length ?? 0) + offset,
      firstOccurrence: true,
      plainTemplate: false,
      span: { start: 0, end: 0 },
    })),
  ];
  const loaders = [
    ...(opts.demand ?? []).map((canonical, ordinal) => ({
      targetKind: "escaped-direct" as const,
      registryFn: "_update_loader",
      rendererId: `demand:${moduleKey}:${ordinal}`,
      targets: [{ specifier: canonical, canonical }],
      ordinal,
      firstWins: true,
    })),
    ...(opts.scheduled ?? []).map((canonical, ordinal) => ({
      targetKind: "scheduled-load-ready" as const,
      registryFn: "_load_ready",
      rendererId: `scheduled:${moduleKey}:${ordinal}`,
      readyId: `ready:${moduleKey}:${ordinal}`,
      targets: [{ specifier: canonical, canonical }],
      ordinal,
      firstWins: true,
    })),
  ];
  return {
    schemaVersion: "finalized-plan@1",
    moduleKey,
    importer: `${moduleKey}?persisted`,
    originFile: moduleKey,
    fingerprintFields: {},
    statements: [],
    symbols: {},
    requestedModules,
    exports: [],
    loaders,
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
      deferred: opts.deferred ?? [],
    },
    resolutionDeps: [],
    resolverConfigTag: "",
    fingerprint:
      opts.fingerprint ??
      crypto.createHash("sha256").update(`plan:${moduleKey}`).digest("hex"),
  };
}

function request(
  kind: FinalizedPlan["requestedModules"][number]["kind"],
  canonical: string,
  ordinal: number,
): FinalizedPlan["requestedModules"][number] {
  return {
    specifier: canonical,
    canonical,
    attributes: [],
    kind,
    form: kind === "lazy-edge" ? "dynamic-import" : "import",
    bare: false,
    ordinal,
    firstOccurrence: true,
    plainTemplate: false,
    span: { start: 0, end: 0 },
  };
}

const token = { epoch: 4, configEpoch: "config-a" };

function input(
  plans: FinalizedPlan[],
  routes: PartitionRoute[],
): PartitionInput {
  return { plans, routes, publicationToken: token };
}

function byModule(
  state: ReturnType<typeof computePartition>,
  moduleKey: string,
) {
  return state.cells.find((cell) => cell.moduleKeys.includes(moduleKey))!;
}

function lazyIslandInput() {
  const plans = [
    finalizedPlan("route:A", {
      lazy: ["lazy:panel"],
      demand: ["lazy:panel"],
      claimable: ["shell:page"],
      deferred: ["shell:panel"],
    }),
    finalizedPlan("lazy:panel", {
      capability: ["shell:panel"],
      claimable: ["shell:panel"],
    }),
  ];
  return input(plans, [{ routeIndex: 0, entryModuleKey: "route:A" }]);
}

describe("persisted-plan activation-root partition (C1)", () => {
  it("C1-Pure1: shuffled finalized plans and routes produce byte-identical canonical PartitionState", () => {
    const plans = [
      finalizedPlan("route:A", { sync: ["shared"] }),
      finalizedPlan("route:B", { sync: ["shared"] }),
      finalizedPlan("shared"),
    ];
    const routes = [
      { routeIndex: 0, entryModuleKey: "route:A" },
      { routeIndex: 1, entryModuleKey: "route:B" },
    ];
    const a = computePartition(input(plans, routes));
    const b = computePartition(
      input([...plans].reverse(), [...routes].reverse()),
    );
    assert.equal(a.inputFingerprint, b.inputFingerprint);
    assert.equal(serializePartitionState(a), serializePartitionState(b));
  });

  it("C1-Pure2/C1-Cell1: content fingerprint movement changes input identity but leaves root-set cell ids stable", () => {
    const routes = [{ routeIndex: 0, entryModuleKey: "route:A" }];
    const before = computePartition(
      input([finalizedPlan("route:A", { fingerprint: "before" })], routes),
    );
    const after = computePartition(
      input([finalizedPlan("route:A", { fingerprint: "after" })], routes),
    );
    assert.notEqual(before.inputFingerprint, after.inputFingerprint);
    assert.equal(
      before.moduleCellIds["route:A"],
      after.moduleCellIds["route:A"],
    );
    assert.doesNotMatch(before.cells[0].cellId, /before|after/);
  });

  it("C1-Root1: one eager page plus one demand loader makes two resolver-moduleKey roots while scheduled readiness makes none", () => {
    const state = computePartition(
      input(
        [
          finalizedPlan("route:A", {
            lazy: ["lazy:panel", "ready:only"],
            demand: ["lazy:panel"],
            scheduled: ["ready:only"],
          }),
          finalizedPlan("lazy:panel"),
          finalizedPlan("ready:only"),
        ],
        [{ routeIndex: 0, entryModuleKey: "route:A" }],
      ),
    );
    assert.deepEqual(
      state.roots.map(({ rootId, kind }) => [rootId, kind]),
      [
        ["lazy:panel", "lazy-boundary"],
        ["route:A", "eager-route"],
      ],
    );
  });

  it("C1-Root1/C1-Inc2: scheduled readiness does not activate a target that is independently a demand root elsewhere", () => {
    const state = computePartition(
      input(
        [
          finalizedPlan("route:scheduled", {
            lazy: ["lazy:shared"],
            scheduled: ["lazy:shared"],
          }),
          finalizedPlan("route:demand", {
            lazy: ["lazy:shared"],
            demand: ["lazy:shared"],
          }),
          finalizedPlan("lazy:shared"),
        ],
        [
          { routeIndex: 0, entryModuleKey: "route:scheduled" },
          { routeIndex: 1, entryModuleKey: "route:demand" },
        ],
      ),
    );
    assert.deepEqual(byModule(state, "lazy:shared").routeIncidence, [1]);
  });

  it("C2-LazyMap1: a plan-backed scheduled host virtual is a published lazy root", () => {
    const setup = finalizedPlan("virtual:setup");
    setup.resolutionDeps = [
      {
        importer: "virtual:setup",
        specifier: "virtual:setup",
        attrsKey: "[]",
        canonical: "virtual:setup",
        virtualContentHash: "setup-source",
      },
    ];
    const state = computePartition(
      input(
        [
          finalizedPlan("route:A", {
            lazy: ["virtual:setup"],
            scheduled: ["virtual:setup"],
          }),
          setup,
        ],
        [{ routeIndex: 0, entryModuleKey: "route:A" }],
      ),
    );
    assert.equal(
      state.lazyRootCellIds["virtual:setup"],
      state.moduleCellIds["virtual:setup"],
    );
  });

  it("C1-Root2: equal route incidence does not merge distinct lazy targets and a multiply activated target stays one root", () => {
    const state = computePartition(
      input(
        [
          finalizedPlan("route:A", {
            lazy: ["lazy:x", "lazy:y", "lazy:shared"],
            demand: ["lazy:x", "lazy:y", "lazy:shared"],
          }),
          finalizedPlan("route:B", {
            lazy: ["lazy:shared"],
            demand: ["lazy:shared"],
          }),
          finalizedPlan("lazy:x"),
          finalizedPlan("lazy:y"),
          finalizedPlan("lazy:shared"),
        ],
        [
          { routeIndex: 0, entryModuleKey: "route:A" },
          { routeIndex: 1, entryModuleKey: "route:B" },
        ],
      ),
    );
    const lazyRoots = state.roots.filter(
      (root) => root.kind === "lazy-boundary",
    );
    assert.equal(lazyRoots.length, 3);
    assert.equal(
      lazyRoots.filter((root) => root.moduleKey === "lazy:shared").length,
      1,
    );
    assert.notEqual(
      state.lazyRootCellIds["lazy:x"],
      state.lazyRootCellIds["lazy:y"],
    );
  });

  it("C1-Inc1: repeated lazy activation converges on one target cell and an unrelated route cannot move its root-set cell id", () => {
    const plans = [
      finalizedPlan("route:A"),
      finalizedPlan("route:B", {
        lazy: ["lazy:T"],
        demand: ["lazy:T"],
      }),
      finalizedPlan("route:C", {
        lazy: ["lazy:T"],
        demand: ["lazy:T"],
      }),
      finalizedPlan("lazy:T"),
    ];
    const routes = [
      { routeIndex: 0, entryModuleKey: "route:A" },
      { routeIndex: 1, entryModuleKey: "route:B" },
      { routeIndex: 2, entryModuleKey: "route:C" },
    ];
    const before = computePartition(input(plans, routes));
    const after = computePartition(
      input(
        [...plans, finalizedPlan("route:D")],
        [...routes, { routeIndex: 3, entryModuleKey: "route:D" }],
      ),
    );
    assert.deepEqual(byModule(before, "lazy:T").routeIncidence, [1, 2]);
    assert.equal(before.moduleCellIds["lazy:T"], after.moduleCellIds["lazy:T"]);
  });

  it("C1-Inc2/C1-Cap1: loader targets and lazy edges never leak capability or deferred ids into eager possession", () => {
    const state = computePartition(lazyIslandInput());
    assert.deepEqual(state.routeProjections["0"].possessionShellIds, [
      "shell:page",
    ]);
    assert.deepEqual(byModule(state, "lazy:panel").capabilityShellIds, [
      "shell:panel",
    ]);
    assert.deepEqual(byModule(state, "lazy:panel").routeIncidence, [0]);
    assert.ok(
      !state.routeProjections["0"].eagerCellIds.includes(
        state.moduleCellIds["lazy:panel"],
      ),
    );
  });

  it("C1-Inc2: the binding sync-edge/non-edge table walks only internalized-child, load-edge-child, and in-universe module-state", () => {
    const entry = finalizedPlan("route:edge-table", {
      demand: ["demand:loader-only"],
    });
    entry.requestedModules = [
      request("internalized-child", "sync:internal", 0),
      request("load-edge-child", "sync:load-child", 1),
      request("module-state", "sync:module-state", 2),
      request("module-state", "outside:plain", 3),
      request("lazy-edge", "demand:lazy", 4),
      request("eager-candidate", "non-edge:eager-candidate", 5),
      request("external", "non-edge:external", 6),
    ];
    entry.loaders.push({
      targetKind: "escaped-direct",
      registryFn: "_update_loader",
      rendererId: "demand:lazy",
      targets: [{ specifier: "demand:lazy", canonical: "demand:lazy" }],
      ordinal: 4,
      firstWins: true,
    });
    const state = computePartition(
      input(
        [
          entry,
          finalizedPlan("sync:internal"),
          finalizedPlan("sync:load-child"),
          finalizedPlan("sync:module-state"),
          finalizedPlan("demand:loader-only"),
          finalizedPlan("demand:lazy"),
          finalizedPlan("non-edge:eager-candidate"),
          finalizedPlan("non-edge:external"),
        ],
        [{ routeIndex: 0, entryModuleKey: "route:edge-table" }],
      ),
    );
    const eagerCellIds = new Set(state.routeProjections["0"].eagerCellIds);
    for (const moduleKey of [
      "route:edge-table",
      "sync:internal",
      "sync:load-child",
      "sync:module-state",
    ]) {
      assert.ok(eagerCellIds.has(state.moduleCellIds[moduleKey]), moduleKey);
    }
    for (const moduleKey of [
      "demand:loader-only",
      "demand:lazy",
      "non-edge:eager-candidate",
      "non-edge:external",
    ]) {
      assert.ok(!eagerCellIds.has(state.moduleCellIds[moduleKey]), moduleKey);
    }
    assert.deepEqual(byModule(state, "demand:loader-only").routeIncidence, []);
    assert.deepEqual(byModule(state, "demand:lazy").routeIncidence, [0]);
  });

  it("C1-Inc1/C1-Cell1: sync SCC mates receive the union of every incident activation root", () => {
    const state = computePartition(
      input(
        [
          finalizedPlan("route:A", { sync: ["cycle:x"] }),
          finalizedPlan("route:B", { sync: ["cycle:y"] }),
          finalizedPlan("cycle:x", { sync: ["cycle:y"] }),
          finalizedPlan("cycle:y", { sync: ["cycle:x"] }),
        ],
        [
          { routeIndex: 0, entryModuleKey: "route:A" },
          { routeIndex: 1, entryModuleKey: "route:B" },
        ],
      ),
    );
    assert.equal(
      state.moduleCellIds["cycle:x"],
      state.moduleCellIds["cycle:y"],
    );
    assert.deepEqual(byModule(state, "cycle:x").rootSet, [
      "route:A",
      "route:B",
    ]);
  });

  it("C1-Cell1: full-root-set encoding cannot collide across ambiguous moduleKey concatenations", () => {
    const state = computePartition(
      input(
        [
          finalizedPlan("a", { sync: ["target:x"] }),
          finalizedPlan("bc", { sync: ["target:x"] }),
          finalizedPlan("ab", { sync: ["target:y"] }),
          finalizedPlan("c", { sync: ["target:y"] }),
          finalizedPlan("target:x"),
          finalizedPlan("target:y"),
        ],
        [
          { routeIndex: 0, entryModuleKey: "a" },
          { routeIndex: 1, entryModuleKey: "bc" },
          { routeIndex: 2, entryModuleKey: "ab" },
          { routeIndex: 3, entryModuleKey: "c" },
        ],
      ),
    );
    assert.deepEqual(byModule(state, "target:x").rootSet, ["a", "bc"]);
    assert.deepEqual(byModule(state, "target:y").rootSet, ["ab", "c"]);
    assert.notEqual(
      state.moduleCellIds["target:x"],
      state.moduleCellIds["target:y"],
    );
  });

  it("C1-Docs1: many routes sharing one finalized module produce one shared capability cell", () => {
    const plans = [
      finalizedPlan("docs:shared", { capability: ["shell:docs"] }),
    ];
    const routes: PartitionRoute[] = [];
    for (let routeIndex = 0; routeIndex < 20; routeIndex++) {
      const entry = `route:docs:${routeIndex}`;
      plans.push(finalizedPlan(entry, { sync: ["docs:shared"] }));
      routes.push({ routeIndex, entryModuleKey: entry });
    }
    const state = computePartition(input(plans, routes));
    const sharedCells = state.cells.filter((cell) =>
      cell.moduleKeys.includes("docs:shared"),
    );
    assert.equal(sharedCells.length, 1);
    assert.deepEqual(sharedCells[0].capabilityShellIds, ["shell:docs"]);
  });

  it("C1-Bro1: mostly unique brochure modules stay in distinct cells without a global mega-cell", () => {
    const plans: FinalizedPlan[] = [];
    const routes: PartitionRoute[] = [];
    for (let routeIndex = 0; routeIndex < 12; routeIndex++) {
      const entry = `route:brochure:${routeIndex}`;
      const unique = `brochure:unique:${routeIndex}`;
      plans.push(
        finalizedPlan(entry, { sync: [unique] }),
        finalizedPlan(unique),
      );
      routes.push({ routeIndex, entryModuleKey: entry });
    }
    const state = computePartition(input(plans, routes));
    assert.equal(new Set(state.cells.map((cell) => cell.cellId)).size, 12);
    assert.ok(state.cells.every((cell) => cell.rootSet.length === 1));
  });

  it("C1-Gen1: the store warms by content fingerprint and rebinds identical content to a new generation epoch without recompute", () => {
    const store = new PartitionStore();
    const base = lazyIslandInput();
    const first = store.ensure(base);
    const warm = store.ensure(base);
    store.invalidate();
    const rebound = store.ensure({
      ...base,
      publicationToken: { ...token, epoch: token.epoch + 1 },
    });
    assert.equal(first.inputFingerprint, warm.inputFingerprint);
    assert.equal(first.inputFingerprint, rebound.inputFingerprint);
    assert.equal(
      serializePartitionState(first, false),
      serializePartitionState(rebound, false),
    );
    assert.equal(store.getStats().computes, 1);
    assert.equal(store.getStats().warmHits, 2);
    assert.equal(rebound.publicationToken.epoch, token.epoch + 1);
  });

  it("C1-S1/C1-Z2/C1-Z3/C1-PossSoft: the spectrum matrix stays finite and reports server-only size and possession projection", () => {
    const state = computePartition(lazyIslandInput());
    const json = serializePartitionState(state);
    const rawBytes = Buffer.byteLength(json);
    const brBytes = brotliCompressSync(json).byteLength;
    const possessionJson = JSON.stringify(
      state.routeProjections["0"].possessionShellIds,
    );
    const projectedPossessionBrPerRoute =
      brotliCompressSync(possessionJson).byteLength;
    assert.ok(rawBytes > 0 && brBytes > 0);
    assert.deepEqual(state.routeProjections["0"].possessionShellIds, [
      "shell:page",
    ]);
    if (process.env.C1_REPORT_METRICS) {
      process.stdout.write(
        `\nC1_REPORT_METRICS ${JSON.stringify({
          gate: "C1-Z2/C1-Z3/C1-PossSoft",
          routes: 1,
          rawBytes,
          brBytes,
          rawBytesPerRoute: rawBytes,
          brBytesPerRoute: brBytes,
          projectedPossessionBrPerRoute,
          possessionVsScrape:
            "synthetic corpus agrees; production equality remains soft",
        })}\n`,
      );
    }
  });

  describe("sealed host universe", () => {
    let appIntake: PlanIntake;
    let simpleIntake: PlanIntake;

    before(async function (this: Mocha.Context) {
      this.timeout(120_000);
      const [app, simple] = await Promise.all([
        compiledFixture(APP_ENTRY),
        compiledFixture(SIMPLE_ENTRY),
      ]);
      appIntake = {
        id: APP_ENTRY,
        carrier: app.carrier,
        resolver: new MockViteResolver({
          virtuals: Object.fromEntries(app.virtualSources),
        }),
        selfPlainRaw: app.carrier?.entry.moduleStateLinks[0]?.specifier,
      };
      simpleIntake = {
        id: SIMPLE_ENTRY,
        carrier: simple.carrier,
        resolver: new MockViteResolver(),
        selfPlainRaw: simple.carrier?.entry.moduleStateLinks[0]?.specifier,
      };
    });

    it("C1-Fail1/C1-FailDev: build seal names a missing page while dev remains dirty and publishes only after completion", async () => {
      const host = createPersistedPlanHost();
      const route = { routeIndex: 7, templateFilePath: APP_ENTRY };
      assert.throws(
        () => host.sealPartition([route], "build"),
        /route 7.*entry\.marko/,
      );
      const partial = host.sealPartition([route], "dev");
      assert.equal(partial.state, undefined);
      assert.equal(partial.dirty, true);
      await host.ensureFinalized({ ...appIntake, env: "client" });
      const complete = host.sealPartition([route], "dev");
      assert.ok(complete.state);
      assert.equal(complete.dirty, false);
    });

    it("C1-Gen1: a structural route-map change unpublishes immediately while an identical W3 rebuild stays warm", async () => {
      const host = createPersistedPlanHost();
      const route = { routeIndex: 0, templateFilePath: APP_ENTRY };
      host.notePartitionRoutes([route]);
      await host.ensureFinalized({ ...appIntake, env: "client" });
      host.sealPartition([route], "dev");
      const before = host.getPartitionStats();

      host.notePartitionRoutes([{ ...route }]);
      assert.ok(host.getPublishedPartition());
      assert.equal(
        host.getPartitionStats().invalidations,
        before.invalidations,
      );

      host.notePartitionRoutes([
        route,
        { routeIndex: 1, templateFilePath: "/app/new-route.marko" },
      ]);
      assert.equal(host.getPublishedPartition(), undefined);
      const incomplete = host.sealPartition(
        [route, { routeIndex: 1, templateFilePath: "/app/new-route.marko" }],
        "dev",
      );
      assert.equal(incomplete.dirty, true);
    });

    it("C1-Snap1: snapshotCommitted exposes only current client epoch×configEpoch sets and never SSR or evicted ghosts", async () => {
      const host = createPersistedPlanHost();
      await host.ensureFinalized({ ...appIntake, env: "client" });
      await host.ensureFinalized({ ...simpleIntake, env: "ssr" });
      assert.equal(host.snapshotCommitted("client").length, 1);
      assert.equal(host.snapshotCommitted("ssr").length, 1);
      host.handleFileChange(APP_ENTRY);
      assert.equal(host.snapshotCommitted("client").length, 0);
      assert.equal(host.snapshotCommitted("ssr").length, 1);
      host.onCompilerCacheWipe();
      assert.equal(host.snapshotCommitted("client").length, 0);
      assert.equal(host.snapshotCommitted("ssr").length, 0);
    });

    it("C1-Gen1: W1 invalidates publication, W3 stays warm, and W4 identical finalize-again rebinds without content recompute", async () => {
      const host = createPersistedPlanHost();
      const route = [{ routeIndex: 0, templateFilePath: APP_ENTRY }];
      await host.ensureFinalized({ ...appIntake, env: "client" });
      const first = host.sealPartition(route, "build").state!;
      const firstStats = host.getPartitionStats();
      host.handleFileChange("/app/src/routes/about/+handler.ts");
      const w3 = host.sealPartition(route, "build").state!;
      assert.equal(w3.inputFingerprint, first.inputFingerprint);
      assert.equal(
        host.getPartitionStats().computes,
        firstStats.computes,
        "W3 must be a partition warm hit",
      );

      host.handleFileChange(APP_ENTRY);
      assert.equal(host.getPublishedPartition(), undefined);
      await host.ensureFinalized({ ...appIntake, env: "client" });
      const w1 = host.sealPartition(route, "build").state!;
      assert.equal(w1.inputFingerprint, first.inputFingerprint);

      const beforeW4 = host.getPartitionStats();
      host.onCompilerCacheWipe();
      assert.equal(host.getPublishedPartition(), undefined);
      await host.ensureFinalized({ ...appIntake, env: "client" });
      const w4 = host.sealPartition(route, "build").state!;
      assert.equal(w4.inputFingerprint, first.inputFingerprint);
      assert.equal(host.getPartitionStats().computes, beforeW4.computes);
      assert.notEqual(w4.publicationToken.epoch, first.publicationToken.epoch);
    });

    it("C1-Gen1: cancellation mid-finalize never enters snapshotCommitted and never publishes a partition", async () => {
      const host = createPersistedPlanHost();
      const base = appIntake.resolver;
      const slow = {
        async resolveId(...args: Parameters<typeof base.resolveId>) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return base.resolveId(...args);
        },
      };
      const pending = host.ensureFinalized({
        ...appIntake,
        resolver: slow,
        env: "client",
      });
      await new Promise((resolve) => setTimeout(resolve, 1));
      host.handleFileChange(APP_ENTRY);
      await assert.rejects(
        pending,
        (err: Error) => err instanceof CancelledError,
      );
      assert.equal(host.snapshotCommitted("client").length, 0);
      assert.equal(host.getPublishedPartition(), undefined);
    });

    it("C1-Gen2: W2 configEpoch changes abandon plans and publication while an identical config epoch stays warm", async () => {
      const host = createPersistedPlanHost();
      const route = [{ routeIndex: 0, templateFilePath: APP_ENTRY }];
      host.setConfigEpoch("config-a");
      await host.ensureFinalized({ ...appIntake, env: "client" });
      host.sealPartition(route, "build");
      const before = host.getPartitionStats();
      host.setConfigEpoch("config-a");
      assert.ok(host.getPublishedPartition());
      assert.equal(
        host.getPartitionStats().invalidations,
        before.invalidations,
      );
      host.setConfigEpoch("config-b");
      assert.equal(host.snapshotCommitted("client").length, 0);
      assert.equal(host.getPublishedPartition(), undefined);
    });
  });

  describe("C1 non-goal pins", () => {
    it("C1-X1/C1-Z1: the client route table remains ?persisted and contains no PartitionState JSON", () => {
      const route = {
        index: 3,
        page: { filePath: "/app/src/routes/+page.marko" },
        templateFilePath: "/app/.marko-run/index/route.marko",
        path: { segments: [] },
      } as unknown as Route;
      const source = renderRoutesClient(
        { list: [route] } as unknown as BuiltRoutes,
        "/app",
      );
      assert.match(source, /route\.marko\?persisted/);
      assert.doesNotMatch(source, /partition-state@1|inputFingerprint|cellId/);
    });

    it("C1-X2: the static-shell scrape and __MARKO_RUN_SHELLS__ assembly remain the production path", () => {
      const pluginSource = fs.readFileSync(
        path.resolve(import.meta.dirname, "../../plugin.ts"),
        "utf8",
      );
      assert.match(pluginSource, /collectShellManifest/);
      assert.match(pluginSource, /__MARKO_RUN_SHELLS__/);
    });

    it("C3-X4: cutover client graph is derived from emission on persistedBuild", () => {
      const pluginSource = fs.readFileSync(
        path.resolve(import.meta.dirname, "../../plugin.ts"),
        "utf8",
      );
      assert.match(pluginSource, /cutoverClientGraph:\s*artifactEmissionActive/);
      assert.match(pluginSource, /persistedBuild\s*=\s*\{/);
    });
  });
});

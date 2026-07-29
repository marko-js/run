// C0 round-1 gate families over the plan coordinator (work/c0-brief.md):
// schema pin (dispatch condition 3), P0 finalize port (A1/A7 + seam),
// P1 generation rules (C/E/D families), P3 invalidation channels — the
// A-family greens ride PRODUCTION channels only (configEpoch W2, reverse
// index W1), never test-only bypasses — plus F2/F3 suppression transitions
// and the G behavior-freeze pins. Carriers are REAL: compiled by the
// frozen marko checkout, never hand-built.
import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import { parseSync } from "oxc-parser";
import path from "path";
import { performance } from "perf_hooks";

import { renderRoutesClient } from "../../codegen";
import type { ConfigEpochSlice } from "../../persisted-plan/config-epoch";
import {
  computeConfigEpoch,
  configEpochSliceFromVite,
} from "../../persisted-plan/config-epoch";
import type { PlanIntake } from "../../persisted-plan/coordinator";
import {
  CancelledError,
  createPersistedPlanHost,
  PlanCoordinator,
} from "../../persisted-plan/coordinator";
import type {
  FinalizedSet,
  PreliminaryUpdatePlans,
} from "../../persisted-plan/finalize";
import {
  assertCanonicalLoadEdgeCoverage,
  finalizeSet,
  fingerprintOf,
} from "../../persisted-plan/finalize";
import {
  PRELIMINARY_PLAN_SCHEMA_SHA256,
  PRELIMINARY_PLAN_SCHEMA_SOURCE,
} from "../../persisted-plan/schema-pin";
import type { BuiltRoutes, Route } from "../../types";
import { findStaticShellIds } from "../../utils/static-shells";
import type { CompiledFixture } from "./utils/frozen-marko";
import {
  APP_ENTRY,
  cloneCarrier,
  compiledFixture,
  MARKO_REPO,
  SIMPLE_ENTRY,
} from "./utils/frozen-marko";
import type { MockResolverConfig } from "./utils/mock-resolver";
import { contentHash, MockViteResolver } from "./utils/mock-resolver";

const APP_DIR = path.dirname(APP_ENTRY);
const PANEL_SETUP_ID = "././tags/panel.marko.setup.js";
const PANEL_SETUP_CANONICAL = path.join(APP_DIR, "tags/panel.marko.setup.js");

let app: CompiledFixture;
let simple: CompiledFixture;

function appResolver(overrides?: Partial<MockResolverConfig>) {
  return new MockViteResolver({
    virtuals: {
      [PANEL_SETUP_CANONICAL]: app.virtualSources.get(PANEL_SETUP_ID)!,
    },
    ...overrides,
  });
}

function appCarrier(): PreliminaryUpdatePlans {
  return app.carrier!;
}

function appIntake(overrides?: Partial<PlanIntake>): PlanIntake {
  return {
    id: APP_ENTRY,
    carrier: appCarrier(),
    resolver: appResolver(),
    selfPlainRaw: appCarrier().entry.moduleStateLinks[0]?.specifier,
    ...overrides,
  };
}

function simpleIntake(overrides?: Partial<PlanIntake>): PlanIntake {
  return {
    id: SIMPLE_ENTRY,
    carrier: simple.carrier!,
    resolver: new MockViteResolver(),
    selfPlainRaw: simple.carrier!.entry.moduleStateLinks[0]?.specifier,
    ...overrides,
  };
}

async function finalizeApp(
  resolver = appResolver(),
  carrier = appCarrier(),
): Promise<FinalizedSet> {
  return finalizeSet(carrier, {
    resolver,
    selfPlainRaw: carrier.entry.moduleStateLinks[0]?.specifier,
    selfContext: APP_ENTRY,
  });
}

const baseSlice: ConfigEpochSlice = {
  alias: [],
  conditions: ["module", "browser"],
  extensions: [".mjs", ".js", ".ts", ".marko"],
  dedupe: [],
  mainFields: ["module"],
  preserveSymlinks: false,
  markoPluginNames: ["marko-vite:pre", "marko-vite:post"],
  markoOptions: { runtimeId: undefined },
};

const tick = (ms = 1) => new Promise((resolve) => setTimeout(resolve, ms));

describe("persisted-plan (C0-R1)", () => {
  before(async function (this: Mocha.Context) {
    // Frozen-marko compiles run in a subprocess; give them room once.
    this.timeout(120_000);
    app = await compiledFixture(APP_ENTRY);
    simple = await compiledFixture(SIMPLE_ENTRY);
    assert.ok(app.carrier, "app fixture must publish a carrier");
    assert.ok(simple.carrier, "simple fixture must publish a carrier");
  });

  describe("schema pin (dispatch condition 3)", () => {
    it("S1: the vendored preliminary-plan schema is byte-identical to the frozen marko source", () => {
      const vendored = fs.readFileSync(
        path.resolve(
          import.meta.dirname,
          "../../persisted-plan/preliminary-plan.ts",
        ),
      );
      const vendoredHash = crypto
        .createHash("sha256")
        .update(vendored)
        .digest("hex");
      assert.equal(
        vendoredHash,
        PRELIMINARY_PLAN_SCHEMA_SHA256,
        `vendored schema drifted from the pin (${PRELIMINARY_PLAN_SCHEMA_SOURCE})`,
      );
      // And the pin itself matches the frozen checkout on this machine.
      const frozenPath = path.join(
        MARKO_REPO,
        "packages/runtime-tags/src/translator/util/preliminary-plan.ts",
      );
      const frozenHash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(frozenPath))
        .digest("hex");
      assert.equal(
        frozenHash,
        PRELIMINARY_PLAN_SCHEMA_SHA256,
        "frozen marko schema does not match the pin — marko moved under the freeze?",
      );
    });
  });

  describe("P0 finalize port", () => {
    it("A1: cold finalization is deterministic — two independent finalizes agree on every fingerprint", async () => {
      const first = await finalizeApp();
      const second = await finalizeApp();
      assert.equal(first.entry.fingerprint, second.entry.fingerprint);
      assert.deepEqual(
        Object.entries(first.virtuals).map(([id, p]) => [id, p.fingerprint]),
        Object.entries(second.virtuals).map(([id, p]) => [id, p.fingerprint]),
      );
    });

    it("A7: resolutionDeps are load-bearing in the fingerprint — a virtual content mutation moves identity while the includeDeps:false control collides", async () => {
      const before = await finalizeApp();
      const mutated = await finalizeApp(
        appResolver({
          virtuals: {
            [PANEL_SETUP_CANONICAL]:
              app.virtualSources.get(PANEL_SETUP_ID)! + "\n// drift",
          },
        }),
      );
      // The substituted content is untouched (same canonical) — only the
      // consumed resolver fact changed.
      assert.notEqual(before.entry.fingerprint, mutated.entry.fingerprint);
      const { fingerprint: _a, ...bodyA } = before.entry;
      const { fingerprint: _b, ...bodyB } = mutated.entry;
      assert.equal(
        fingerprintOf(bodyA, false),
        fingerprintOf(bodyB, false),
        "the includeDeps:false control must collide — deps are the ONLY delta",
      );
    });

    it("A7-tag: the resolver config tag never enters the fingerprint", async () => {
      const carrier = appCarrier();
      const tagged = await finalizeSet(carrier, {
        resolver: appResolver(),
        selfPlainRaw: carrier.entry.moduleStateLinks[0]?.specifier,
        selfContext: APP_ENTRY,
        resolverConfigTag: "config-A",
      });
      const retagged = await finalizeSet(carrier, {
        resolver: appResolver(),
        selfPlainRaw: carrier.entry.moduleStateLinks[0]?.specifier,
        selfContext: APP_ENTRY,
        resolverConfigTag: "config-B",
      });
      assert.equal(tagged.entry.fingerprint, retagged.entry.fingerprint);
    });

    it("Q5: a classifier seam mismatch fails the build (corrupted emission-site kind)", async () => {
      const corrupted = cloneCarrier(appCarrier());
      const child = corrupted.entry.requestedModules.find(
        (ev) => ev.kind === "internalized-child",
      )!;
      (child as { kind: string }).kind = "external";
      await assert.rejects(
        finalizeApp(appResolver(), corrupted),
        (err: Error) =>
          err.name === "FinalizeError" &&
          /classifier seam mismatch/.test(err.message),
      );
    });

    it("V1: an invalid carrier is refused at the boundary before any resolve", async () => {
      const corrupted = cloneCarrier(appCarrier());
      (corrupted.entry as { schemaVersion: string }).schemaVersion = "9.9";
      const resolver = appResolver();
      await assert.rejects(
        finalizeApp(resolver, corrupted),
        (err: Error) => err.name === "SchemaViolation",
      );
      assert.equal(resolver.resolveCount, 0);
    });

    it("E3a (site-37 tie): the compiler-issued virtual id and the parent demand-loader target meet on one canonical", async () => {
      const set = await finalizeApp();
      const demand = set.entry.loaders.find(
        (loader) => loader.targetKind === "setup-virtual-demand",
      )!;
      assert.equal(
        set.virtuals[PANEL_SETUP_ID].moduleKey,
        PANEL_SETUP_CANONICAL,
      );
      assert.equal(demand.targets[0].canonical, PANEL_SETUP_CANONICAL);
    });

    it("E3b: canonical-id divergence in a finalized set is refused (post-finalize coverage runs on canonicals)", async () => {
      const set = await finalizeApp();
      assertCanonicalLoadEdgeCoverage(set.plans); // green on the real set
      const divergent = set.plans.map((plan) =>
        plan === set.virtuals[PANEL_SETUP_ID]
          ? { ...plan, moduleKey: plan.moduleKey + ".moved.js" }
          : plan,
      );
      assert.throws(
        () => assertCanonicalLoadEdgeCoverage(divergent),
        (err: Error) =>
          err.name === "FinalizeError" &&
          /canonical load-edge coverage/.test(err.message),
      );
    });
  });

  describe("P1 generation coordinator", () => {
    it("C2: concurrent requests share ONE in-flight finalize (single-flight)", async () => {
      const coordinator = new PlanCoordinator("client");
      const intake = appIntake();
      const p1 = coordinator.ensureFinalized(intake);
      const p2 = coordinator.ensureFinalized(appIntake());
      const [s1, s2] = await Promise.all([p1, p2]);
      assert.equal(s1, s2, "both callers must receive the same set object");
      assert.equal(coordinator.getGenerationStats().finalizeStarts, 1);
    });

    it("C2b: concurrent finalizes of DIFFERENT templates proceed in parallel (the nesting guard is async-stack-scoped, not a global latch)", async () => {
      // Parallel transforms are the vite norm: the re-entrancy rule bans
      // GENERATION NESTING (a resolver re-entering mid-finalize), never
      // top-level concurrency. Suite-red before the AsyncLocalStorage
      // guard: the C0-R1 counter version refused the second template.
      const coordinator = new PlanCoordinator("client");
      const [a, b] = await Promise.all([
        coordinator.ensureFinalized(appIntake()),
        coordinator.ensureFinalized(simpleIntake()),
      ]);
      assert.ok(a && b);
      assert.equal(coordinator.getGenerationStats().finalizeStarts, 2);
      assert.equal(coordinator.getGenerationStats().committedEntries, 2);
    });

    it("C1/W1: a source edit mid-finalize cancels — a cancelled generation never commits", async () => {
      const coordinator = new PlanCoordinator("client");
      const base = appResolver();
      const slow = {
        async resolveId(...args: Parameters<typeof base.resolveId>) {
          await tick(5);
          return base.resolveId(...args);
        },
      };
      const pending = coordinator.ensureFinalized(
        appIntake({ resolver: slow }),
      );
      await tick();
      coordinator.handleFileChange(APP_ENTRY);
      await assert.rejects(
        pending,
        (err: Error) => err instanceof CancelledError,
      );
      const stats = coordinator.getGenerationStats();
      assert.equal(stats.cancels, 1);
      assert.equal(stats.finalizeCommits, 0);
      assert.equal(stats.committedEntries, 0);
    });

    it("C3/W4: an epoch bump mid-finalize abandons the generation (cancel never commits)", async () => {
      const coordinator = new PlanCoordinator("client");
      const base = appResolver();
      const slow = {
        async resolveId(...args: Parameters<typeof base.resolveId>) {
          await tick(5);
          return base.resolveId(...args);
        },
      };
      const pending = coordinator.ensureFinalized(
        appIntake({ resolver: slow }),
      );
      await tick();
      coordinator.bumpEpoch("test wipe");
      await assert.rejects(
        pending,
        (err: Error) => err instanceof CancelledError,
      );
      assert.equal(coordinator.getGenerationStats().committedEntries, 0);
    });

    it("E1: re-entering the coordinator during a finalize is structurally refused", async () => {
      const coordinator = new PlanCoordinator("client");
      const base = appResolver();
      let innerError: Error | undefined;
      const reentrant = {
        async resolveId(...args: Parameters<typeof base.resolveId>) {
          if (!innerError) {
            try {
              coordinator.ensureFinalized(simpleIntake());
            } catch (err) {
              innerError = err as Error;
            }
          }
          return base.resolveId(...args);
        },
      };
      await coordinator.ensureFinalized(appIntake({ resolver: reentrant }));
      assert.ok(innerError, "the nested ensureFinalized must throw");
      assert.match(innerError!.message, /re-entrant/);
    });

    it("E2: the {entry, virtuals} set is atomic — a failing virtual publishes nothing", async () => {
      const clean = await finalizeApp();
      const coordinator = new PlanCoordinator("client");
      const base = appResolver();
      const failingVirtual = {
        async resolveId(...args: Parameters<typeof base.resolveId>) {
          if (args[1] === PANEL_SETUP_ID) {
            throw new Error("virtual resolve refused (E2 probe)");
          }
          return base.resolveId(...args);
        },
      };
      await assert.rejects(
        coordinator.ensureFinalized(appIntake({ resolver: failingVirtual })),
        /virtual resolve refused/,
      );
      const stats = coordinator.getGenerationStats();
      assert.equal(stats.committedEntries, 0);
      assert.equal(
        coordinator.getByFingerprint(clean.entry.fingerprint),
        undefined,
        "not even the (successful) entry plan may be published",
      );
    });

    it("D1/D3: environments are hard-isolated — the same carrier misses across envs", async () => {
      const host = createPersistedPlanHost();
      const set = (await host.ensureFinalized({
        ...appIntake(),
        env: "client",
      }))!;
      assert.ok(host.getByFingerprint(set.entry.fingerprint, "client"));
      assert.equal(
        host.getByFingerprint(set.entry.fingerprint, "ssr"),
        undefined,
        "an envKey mismatch is a hard miss",
      );
      await host.ensureFinalized({ ...appIntake(), env: "ssr" });
      const stats = host.getGenerationStats();
      assert.equal(stats.client.finalizeStarts, 1);
      assert.equal(
        stats.ssr.finalizeStarts,
        1,
        "the ssr env must run its own finalize — never a cross-env warm hit",
      );
    });

    it("F2/F3: publication transitions evict — published→suppressed drops the plan, suppressed→published re-finalizes to the same identity", async () => {
      const coordinator = new PlanCoordinator("client");
      const set = (await coordinator.ensureFinalized(appIntake()))!;
      const fingerprint = set.entry.fingerprint;

      // F3: published → suppressed (carrier absent).
      const suppressed = await coordinator.ensureFinalized(
        appIntake({ carrier: undefined }),
      );
      assert.equal(suppressed, null, "absence means print path, never error");
      let stats = coordinator.getGenerationStats();
      assert.equal(stats.committedEntries, 0);
      assert.equal(stats.negativeEntries, 1);
      assert.equal(coordinator.getByFingerprint(fingerprint), undefined);

      // F2: suppressed → published.
      const republished = (await coordinator.ensureFinalized(appIntake()))!;
      stats = coordinator.getGenerationStats();
      assert.equal(stats.committedEntries, 1);
      assert.equal(stats.negativeEntries, 0);
      assert.equal(republished.entry.fingerprint, fingerprint);
    });
  });

  describe("P3 invalidation channels (production A-family)", () => {
    it("A2: a warm hit is epoch equality with ZERO re-resolves", async () => {
      const coordinator = new PlanCoordinator("client");
      const resolver = appResolver();
      const cold = await coordinator.ensureFinalized(appIntake({ resolver }));
      const resolveCount = resolver.resolveCount;
      const warm = await coordinator.ensureFinalized(appIntake({ resolver }));
      assert.equal(warm, cold, "warm must return the committed set");
      assert.equal(coordinator.getGenerationStats().warmHits, 1);
      assert.equal(
        resolver.resolveCount,
        resolveCount,
        "the warm path must not touch the resolver (schema-Q6)",
      );
    });

    it("A3/W2: an alias retarget flows through the configEpoch channel — the dependent identity moves", async () => {
      // The app carrier imports "@ui/theme": an alias-dependent request.
      const coordinator = new PlanCoordinator("client");
      coordinator.setConfigEpoch(computeConfigEpoch(baseSlice));
      const before = (await coordinator.ensureFinalized(appIntake()))!;

      const retargeted: ConfigEpochSlice = {
        ...baseSlice,
        alias: [["@ui", "/libs/ui-b"]],
      };
      const epoch = computeConfigEpoch(retargeted);
      assert.notEqual(epoch, computeConfigEpoch(baseSlice));
      coordinator.setConfigEpoch(epoch);
      assert.equal(coordinator.getGenerationStats().committedEntries, 0);

      const after = (await coordinator.ensureFinalized(
        appIntake({
          resolver: appResolver({ alias: { "@ui": "/libs/ui-b" } }),
        }),
      ))!;
      assert.notEqual(after.entry.fingerprint, before.entry.fingerprint);
      const dep = after.entry.resolutionDeps.find(
        (d) => d.specifier === "@ui/theme",
      )!;
      assert.equal(dep.canonical, "/libs/ui-b/theme");
    });

    it("A4: the W2 bump never moves an alias-independent identity — the unrelated template re-finalizes to the SAME fingerprint", async () => {
      const coordinator = new PlanCoordinator("client");
      coordinator.setConfigEpoch(computeConfigEpoch(baseSlice));
      const before = (await coordinator.ensureFinalized(simpleIntake()))!;
      coordinator.setConfigEpoch(
        computeConfigEpoch({ ...baseSlice, alias: [["@ui", "/libs/ui-b"]] }),
      );
      // simple.marko never touches the alias: its identity must hold across
      // the bump (fingerprints exclude the configEpoch by design).
      const after = (await coordinator.ensureFinalized(simpleIntake()))!;
      assert.equal(after.entry.fingerprint, before.entry.fingerprint);
      assert.equal(coordinator.getGenerationStats().finalizeStarts, 2);
    });

    it("A4-shadow/W2: adding an alias that newly shadows a bare specifier moves only the dependent fingerprint", async () => {
      const coordinator = new PlanCoordinator("client");
      coordinator.setConfigEpoch(computeConfigEpoch(baseSlice));
      const dependentBefore = (await coordinator.ensureFinalized(appIntake()))!;
      const unrelatedBefore =
        (await coordinator.ensureFinalized(simpleIntake()))!;
      assert.equal(
        dependentBefore.entry.resolutionDeps.find(
          (dep) => dep.specifier === "@ui/theme",
        )!.canonical,
        "@ui/theme",
        "the control must begin as a negative alias outcome",
      );

      coordinator.setConfigEpoch(
        computeConfigEpoch({
          ...baseSlice,
          alias: [["@ui", "/libs/ui-shadow"]],
        }),
      );
      const dependentAfter = (await coordinator.ensureFinalized(
        appIntake({
          resolver: appResolver({ alias: { "@ui": "/libs/ui-shadow" } }),
        }),
      ))!;
      const unrelatedAfter =
        (await coordinator.ensureFinalized(simpleIntake()))!;

      assert.notEqual(
        dependentAfter.entry.fingerprint,
        dependentBefore.entry.fingerprint,
      );
      assert.equal(
        dependentAfter.entry.resolutionDeps.find(
          (dep) => dep.specifier === "@ui/theme",
        )!.canonical,
        "/libs/ui-shadow/theme",
      );
      assert.equal(
        unrelatedAfter.entry.fingerprint,
        unrelatedBefore.entry.fingerprint,
        "the env-wide W2 abandon may re-finalize unrelated plans, but their identity must hold",
      );
    });

    it("A5/W1: a virtual content mutation invalidates ONLY its reverse set — and the deps-only control collides", async () => {
      const coordinator = new PlanCoordinator("client");
      const before = (await coordinator.ensureFinalized(appIntake()))!;
      await coordinator.ensureFinalized(simpleIntake());
      assert.equal(coordinator.getGenerationStats().committedEntries, 2);

      const invalidated = coordinator.handleFileChange(PANEL_SETUP_CANONICAL);
      assert.equal(invalidated, 1, "exactly the dependent plan set");
      assert.equal(
        coordinator.getGenerationStats().committedEntries,
        1,
        "the unrelated template must stay warm (selective, never env-wide)",
      );

      const mutatedContent = app.virtualSources.get(PANEL_SETUP_ID)! + "\n;;";
      const after = (await coordinator.ensureFinalized(
        appIntake({
          resolver: appResolver({
            virtuals: { [PANEL_SETUP_CANONICAL]: mutatedContent },
          }),
        }),
      ))!;
      assert.notEqual(after.entry.fingerprint, before.entry.fingerprint);
      // Control: with deps stripped the two bodies collide — the reverse
      // index + dep hash are what carry this invalidation class.
      const { fingerprint: _a, ...bodyA } = before.entry;
      const { fingerprint: _b, ...bodyB } = after.entry;
      assert.equal(fingerprintOf(bodyA, false), fingerprintOf(bodyB, false));
      assert.equal(
        after.entry.resolutionDeps.find(
          (d) => d.canonical === PANEL_SETUP_CANONICAL,
        )!.virtualContentHash,
        contentHash(mutatedContent),
      );
    });

    it("A6-synthetic/W2: a synthetic persisted-query rewrite flows through the configEpoch slice", async () => {
      // @marko/vite owns one fixed `?persisted` -> internal-entry rewrite
      // today; run exposes no configurable rewrite surface to hash. This
      // gate therefore proves the allowlist channel without claiming a
      // production mutation source. Rename back to A6/W2 only when that
      // source exists and configEpochSliceFromVite consumes it.
      const coordinator = new PlanCoordinator("client");
      coordinator.setConfigEpoch(
        computeConfigEpoch({
          ...baseSlice,
          persistedQueryRewrite: { persisted: "persisted" },
        }),
      );
      const before = (await coordinator.ensureFinalized(appIntake()))!;
      coordinator.setConfigEpoch(
        computeConfigEpoch({
          ...baseSlice,
          persistedQueryRewrite: { persisted: "persisted&v=2" },
        }),
      );
      const after = (await coordinator.ensureFinalized(
        appIntake({
          resolver: appResolver({
            queryRewrite: { persisted: "persisted&v=2" },
          }),
        }),
      ))!;
      assert.notEqual(after.entry.fingerprint, before.entry.fingerprint);
      assert.ok(
        after.entry.resolutionDeps.some((d) =>
          d.canonical.endsWith("?persisted&v=2"),
        ),
      );
    });

    it("B3-audit: the explicit non-steady-state audit fully re-resolves a warm entry and detects corrupted dep state", async () => {
      const coordinator = new PlanCoordinator("client");
      const resolver = appResolver();
      const set = (await coordinator.ensureFinalized(appIntake({ resolver })))!;
      const beforeAudit = resolver.resolveCount;
      const clean = await coordinator.auditWarmEntry(appIntake({ resolver }));
      assert.equal(clean.valid, true);
      assert.ok(clean.checked > 0);
      assert.equal(
        resolver.resolveCount - beforeAudit,
        clean.checked,
        "AUDIT is deliberately the full re-resolve slow path",
      );

      const dep = set.entry.resolutionDeps[0]!;
      const canonical = dep.canonical;
      dep.canonical = `${canonical}?corrupted-audit-control`;
      const corrupted = await coordinator.auditWarmEntry(
        appIntake({ resolver }),
      );
      dep.canonical = canonical;
      assert.equal(corrupted.valid, false);
      assert.ok(corrupted.mismatches.length > 0);
    });

    it("B4-audit-cost: warm-fast performs zero resolves while the clearly flagged AUDIT path re-resolves every recorded outcome", async () => {
      const coordinator = new PlanCoordinator("client");
      const resolver = appResolver();
      await coordinator.ensureFinalized(appIntake({ resolver }));
      const coldResolveCount = resolver.resolveCount;

      const warmStart = performance.now();
      for (let i = 0; i < 25; i++) {
        await coordinator.ensureFinalized(appIntake({ resolver }));
      }
      const warmMs = performance.now() - warmStart;
      assert.equal(resolver.resolveCount, coldResolveCount);

      const auditStart = performance.now();
      const audit = await coordinator.auditWarmEntry(appIntake({ resolver }));
      const auditMs = performance.now() - auditStart;
      assert.equal(audit.valid, true);
      assert.equal(resolver.resolveCount - coldResolveCount, audit.checked);
      assert.ok(warmMs >= 0 && auditMs >= 0);
      if (process.env.C0_REPORT_METRICS) {
        process.stdout.write(
          `\nC0_REPORT_METRICS ${JSON.stringify({
            gate: "B4-audit-cost",
            warmHits: 25,
            warmMs,
            auditMs,
            auditResolves: audit.checked,
          })}\n`,
        );
      }
    });

    it("B1: a configEpoch bump abandons env-wide WITHOUT a single re-resolve", async () => {
      const coordinator = new PlanCoordinator("client");
      const resolver = appResolver();
      coordinator.setConfigEpoch(computeConfigEpoch(baseSlice));
      await coordinator.ensureFinalized(appIntake({ resolver }));
      const resolveCount = resolver.resolveCount;
      coordinator.setConfigEpoch(
        computeConfigEpoch({ ...baseSlice, conditions: ["worker"] }),
      );
      const stats = coordinator.getGenerationStats();
      assert.equal(stats.configEpochBumps, 2);
      assert.equal(stats.committedEntries, 0);
      assert.equal(
        resolver.resolveCount,
        resolveCount,
        "the bump itself is resolver-free (B0's per-hit validateDep re-resolve is exactly what production must not do)",
      );
    });

    it("B2: unrelated config never enters the slice (allowlist, not whole-config hashing)", () => {
      const resolve = {
        alias: [{ find: "@ui", replacement: "/libs/ui" }],
        conditions: ["module"],
        extensions: [".js", ".marko"],
        dedupe: [],
        mainFields: ["module"],
        preserveSymlinks: false,
      };
      const plugins = [{ name: "marko-vite:pre" }, { name: "vite:resolve" }];
      const sliceA = configEpochSliceFromVite(
        { resolve, plugins, server: { port: 4000 }, logLevel: "info" } as never,
        { runtimeId: "app" },
      );
      const sliceB = configEpochSliceFromVite(
        {
          resolve,
          plugins,
          server: { port: 5999 },
          logLevel: "silent",
        } as never,
        { runtimeId: "app" },
      );
      assert.equal(computeConfigEpoch(sliceA), computeConfigEpoch(sliceB));
      assert.deepEqual(sliceA.markoPluginNames, ["marko-vite:pre"]);
      // Canonical-JSON hashing is key-order independent.
      const { alias, ...rest } = sliceA;
      const reordered = { ...rest, alias } as ConfigEpochSlice;
      assert.equal(computeConfigEpoch(sliceA), computeConfigEpoch(reordered));
    });

    it("W3-R1: a route-handler-only change touches NOTHING (no epoch, no invalidation, warm stays warm)", async () => {
      // Round-1 expressible form: a file no plan consumed has no reverse
      // set. The REAL configureServer-driven fan-out gate (the run plugin
      // watcher calling into the host) needs the round-2 watch harness.
      const coordinator = new PlanCoordinator("client");
      await coordinator.ensureFinalized(appIntake());
      const before = coordinator.getGenerationStats();
      const invalidated = coordinator.handleFileChange(
        "/app/src/routes/about/+handler.ts",
      );
      assert.equal(invalidated, 0);
      const after = coordinator.getGenerationStats();
      assert.equal(after.selectiveInvalidations, 0);
      assert.equal(after.epochBumps, before.epochBumps);
      assert.equal(after.configEpochBumps, before.configEpochBumps);
      assert.equal(after.committedEntries, 1);
      await coordinator.ensureFinalized(appIntake());
      assert.equal(coordinator.getGenerationStats().warmHits, 1);
    });

    it("W4: a compiler-cache wipe shares the generation boundary — full cold, then the SAME identity", async () => {
      const host = createPersistedPlanHost();
      const before = (await host.ensureFinalized({
        ...appIntake(),
        env: "client",
      }))!;
      host.onCompilerCacheWipe();
      const stats = host.getGenerationStats();
      assert.equal(stats.client.epochBumps, 1);
      assert.equal(stats.ssr.epochBumps, 1);
      assert.equal(stats.client.committedEntries, 0);
      const after = (await host.ensureFinalized({
        ...appIntake(),
        env: "client",
      }))!;
      assert.equal(host.getGenerationStats().client.finalizeStarts, 2);
      assert.equal(after.entry.fingerprint, before.entry.fingerprint);
    });

    it("H1-report: retained app-plan cache size is observable without exposing plan state", async () => {
      const probe = new PlanCoordinator("client");
      const set = (await probe.ensureFinalized(appIntake()))!;
      const stats = probe.getGenerationStats();
      const plansPerSet = 1 + Object.keys(set.virtuals).length;
      assert.ok(stats.retainedPlanBytes > 0);

      if (process.env.C0_REPORT_METRICS) {
        const sampleCount = 64;
        const held: PlanCoordinator[] = [];
        global.gc?.();
        const beforeHeap = process.memoryUsage().heapUsed;
        for (let i = 0; i < sampleCount; i++) {
          const coordinator = new PlanCoordinator("client");
          await coordinator.ensureFinalized(appIntake());
          held.push(coordinator);
        }
        global.gc?.();
        const heapDelta = process.memoryUsage().heapUsed - beforeHeap;
        process.stdout.write(
          `\nC0_REPORT_METRICS ${JSON.stringify({
            gate: "H1-report",
            sampleCount,
            plansPerSet,
            heapDelta,
            heapBytesPerPlan: heapDelta / (sampleCount * plansPerSet),
            serializedBytesPerSet: stats.retainedPlanBytes,
            retainedCoordinators: held.length,
          })}\n`,
        );
      }
    });

    it("H2-index: selective drop prunes every reverse-index reference for the retired entry", async () => {
      const coordinator = new PlanCoordinator("client");
      await coordinator.ensureFinalized(appIntake());
      await coordinator.ensureFinalized(simpleIntake());
      const before = coordinator.getGenerationStats();
      coordinator.handleFileChange(PANEL_SETUP_CANONICAL);
      const after = coordinator.getGenerationStats();
      assert.equal(after.committedEntries, 1);
      assert.ok(after.reverseRefs < before.reverseRefs);
      assert.ok(after.reverseFiles <= before.reverseFiles);
    });
  });

  describe("G behavior-freeze pins", () => {
    it("G1: the client route table still imports ?persisted per page template", () => {
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
      assert.match(source, /import\("[^"]*route\.marko\?persisted"\)/);
    });

    it("G2: the shell-manifest scrape reads the frozen persisted module — registration ids match the plan's shell capability", () => {
      const parsed = parseSync("entry.marko.js", app.code, {
        astType: "js",
        sourceType: "module",
      });
      const scraped = findStaticShellIds(parsed.program);
      assert.deepEqual(
        scraped,
        appCarrier().entry.shellCapability!.shells.map(
          (shell) => shell.shellId,
        ),
      );
    });

    it("G4-cutover: emission drives cutoverClientGraph on the single persistedBuild host", () => {
      const pluginSource = fs.readFileSync(
        path.resolve(import.meta.dirname, "../../plugin.ts"),
        "utf8",
      );
      assert.match(
        pluginSource,
        /cutoverClientGraph:\s*artifactEmissionActive/,
        "cutover client graph must follow emission (incl. dual A/B off)",
      );
      assert.match(
        pluginSource,
        /persistedBuild\s*=\s*\{/,
        "run constructs one persistedBuild host object for vite",
      );
    });
  });
});

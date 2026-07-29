// P2/F1/G4 integration gates: REAL vite dev servers with the fork
// `@marko/vite` compiling through the frozen marko checkout (see
// utils/vite-harness.mjs — a subprocess because this mocha process is
// tsx-hooked and tsx's CJS transpile breaks the frozen compiler's native
// ESM graph). The harness runs four transforms of the persisted entry:
// baseline, coordinator-hosted, and both again under a REAL foreign
// post-translator babel plugin (the B1 suppression trigger).
import assert from "assert";
import { spawnSync } from "child_process";
import path from "path";

import type { GenerationStats } from "../../persisted-plan/coordinator";
import type { PartitionState } from "../../persisted-plan/partition";
import type { PartitionStoreStats } from "../../persisted-plan/partition-store";

interface HarnessResult {
  code?: string | null;
  stats?: { ssr: GenerationStats; client: GenerationStats } | null;
  partition?: PartitionState | null;
  partitionStats?: PartitionStoreStats | null;
  error?: string;
}
type HarnessReport = Record<
  "pre-c0-parent" | "nohost" | "host" | "suppressed-nohost" | "suppressed-host",
  HarnessResult
>;

let report: HarnessReport;
let watchReport: {
  w1: {
    before: GenerationStats;
    afterEvent: GenerationStats;
    afterRebuild: GenerationStats;
  };
  aPlus: {
    fingerprints: string[];
    planBytes: string[];
    codes: string[];
    stats: GenerationStats;
  };
  c4: {
    stats: GenerationStats;
    committedFingerprints: string[];
    finalFingerprint: string;
  };
  c5: {
    before: GenerationStats;
    afterEvent: GenerationStats;
    afterWarm: GenerationStats;
  };
  c5Fork: {
    before: GenerationStats;
    afterEvent: GenerationStats;
    afterWarm: GenerationStats;
  };
};

describe("persisted-plan vite integration (C0-R1)", () => {
  before(function (this: Mocha.Context) {
    this.timeout(300_000);
    const proc = spawnSync(
      process.execPath,
      [path.join(import.meta.dirname, "utils/vite-harness.mjs")],
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        // The harness MUST run loader-free: `npm test` exports
        // NODE_OPTIONS="--import tsx", and tsx's hooks wedge the frozen
        // compiler's native ESM graph. The hard timeout keeps a broken
        // child from ever holding mocha open (spawnSync blocks the loop).
        env: { ...process.env, NODE_OPTIONS: "" },
        timeout: 240_000,
      },
    );
    assert.equal(
      proc.status,
      0,
      `harness failed (${proc.error ? String(proc.error) : "exit"}):\n${proc.stderr}`,
    );
    report = JSON.parse(proc.stdout) as HarnessReport;
  });

  it("P2: the harvest finalizes a publishable persisted entry through the real pipeline", () => {
    const { host } = report;
    assert.equal(host.error, undefined, host.error);
    const stats = host.stats!.client;
    assert.equal(stats.finalizeStarts, 1);
    assert.equal(stats.finalizeCommits, 1);
    assert.equal(stats.committedEntries, 1);
    assert.equal(stats.negativeEntries, 0);
  });

  it("G4-bytes: registering the plan host never changes the served bytes (print stays ON)", () => {
    assert.ok(report.nohost.code, "baseline transform must produce code");
    assert.equal(
      report.host.code,
      report.nohost.code,
      "harvest is a side channel: served output must be byte-identical",
    );
  });

  it("C1-X3/C1-Z1: sealing the real harvested universe changes no dual-entry served bytes and injects no PartitionState", () => {
    assert.ok(report.host.partition, "the real client harvest must seal");
    assert.equal(report.host.partition!.schemaVersion, "partition-state@1");
    assert.equal(report.host.partitionStats!.computes, 1);
    assert.equal(report.host.code, report.nohost.code);
    assert.doesNotMatch(
      report.host.code!,
      /partition-state@1|inputFingerprint|publicationToken|cellId/,
    );
  });

  it("C1-PossSoft: real plan-eager possession is reported against the current printed shell registrations without replacing scrape", () => {
    const possession =
      report.host.partition!.routeProjections["0"].possessionShellIds;
    const printedRegistrations = possession.filter((shellId) =>
      report.host.code!.includes(`${JSON.stringify(shellId)}:`),
    );
    const missingFromPrint = possession.filter(
      (shellId) => !printedRegistrations.includes(shellId),
    );
    if (process.env.C1_REPORT_METRICS) {
      process.stdout.write(
        `\nC1_REPORT_METRICS ${JSON.stringify({
          gate: "C1-PossSoft",
          possession,
          printedRegistrations,
          missingFromPrint,
          equalityIsHard: false,
        })}\n`,
      );
    }
    assert.ok(possession.length, "the comparison corpus must be non-empty");
  });

  it("G3: the real pre-C0 fork parent and the active coordinator serve byte-identical persisted output", () => {
    assert.ok(
      report["pre-c0-parent"].code,
      "the true pre-C0 parent must compile the representative persisted route",
    );
    assert.equal(report.host.code, report["pre-c0-parent"].code);
  });

  it("F1: a REAL foreign-babel suppressed compile keeps the print path — empty cache, no consumer error, byte-identical output", () => {
    const suppressed = report["suppressed-host"];
    assert.equal(suppressed.error, undefined, suppressed.error);
    assert.ok(suppressed.code, "the suppressed entry must still be served");
    assert.equal(
      suppressed.code,
      report["suppressed-nohost"].code,
      "print-path byte identity under suppression",
    );
    const stats = suppressed.stats!.client;
    assert.equal(stats.finalizeStarts, 0, "no finalize may even start");
    assert.equal(stats.committedEntries, 0, "the coordinator cache is empty");
    assert.equal(
      stats.negativeEntries,
      1,
      "absence is recorded as a negative entry (retry on reappearance)",
    );
  });

  it("F1-control: suppression is the ONLY delta — the served bytes match the unsuppressed baseline", () => {
    // The foreign plugin does not touch this module's printed text (its
    // sentinel lives outside the served entry), so all four pipelines must
    // agree byte-for-byte: the plan decision, not the output, is what the
    // babel config changed.
    assert.equal(report["suppressed-nohost"].code, report.nohost.code);
  });
});

describe("persisted-plan real watch integration (C0-R2)", () => {
  before(function (this: Mocha.Context) {
    this.timeout(300_000);
    const proc = spawnSync(
      process.execPath,
      [path.join(import.meta.dirname, "utils/watch-harness.mjs")],
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, NODE_OPTIONS: "" },
        timeout: 240_000,
      },
    );
    assert.equal(
      proc.status,
      0,
      `watch harness failed (${proc.error ? String(proc.error) : "exit"}):\n${proc.stderr}`,
    );
    watchReport = JSON.parse(proc.stdout) as typeof watchReport;
  });

  it("W1-real: a source edit through the real configureServer watcher selectively invalidates the dependent", () => {
    assert.ok(
      watchReport.w1.afterEvent.selectiveInvalidations >
        watchReport.w1.before.selectiveInvalidations,
    );
    assert.equal(
      watchReport.w1.afterRebuild.finalizeStarts,
      watchReport.w1.before.finalizeStarts + 1,
    );
  });

  it("A+: repeated real edit→rebuild→edit-back cycles are byte- and fingerprint-deterministic", () => {
    const { fingerprints, planBytes } = watchReport.aPlus;
    assert.ok(fingerprints.length >= 5);
    assert.equal(fingerprints[0], fingerprints[2]);
    assert.equal(fingerprints[0], fingerprints[4]);
    assert.equal(planBytes[0], planBytes[2]);
    assert.equal(planBytes[0], planBytes[4]);
    assert.notEqual(fingerprints[0], fingerprints[1]);
    assert.notEqual(fingerprints[0], fingerprints[3]);
  });

  it("C4: adversarial real-watch edit/cancel thrash commits no mixed generation and keeps re-finalization bounded", () => {
    const { stats, committedFingerprints, finalFingerprint } = watchReport.c4;
    assert.ok(stats.cancels >= 2, "the injected edits must cancel in flight");
    assert.equal(stats.committedEntries, 1);
    assert.equal(committedFingerprints.at(-1), finalFingerprint);
    assert.equal(stats.finalizeCommits, committedFingerprints.length);
    assert.ok(
      stats.finalizeStarts <= 8,
      `bounded re-finalization: ${stats.finalizeStarts} starts for the fixed thrash schedule`,
    );
  });

  it("C5/W3: a route-handler-only edit through real configureServer causes zero unchanged-template re-finalizations", () => {
    const { before, afterEvent, afterWarm } = watchReport.c5;
    assert.equal(afterEvent.epochBumps, before.epochBumps);
    assert.equal(
      afterEvent.selectiveInvalidations,
      before.selectiveInvalidations,
    );
    assert.equal(afterWarm.finalizeStarts, before.finalizeStarts);
    assert.equal(afterWarm.finalizeCommits, before.finalizeCommits);
    assert.equal(afterWarm.warmHits, before.warmHits + 1);

    const fork = watchReport.c5Fork;
    assert.equal(fork.afterEvent.epochBumps, fork.before.epochBumps);
    assert.equal(fork.afterWarm.finalizeStarts, fork.before.finalizeStarts);
    assert.equal(fork.afterWarm.finalizeCommits, fork.before.finalizeCommits);
    assert.equal(fork.afterWarm.warmHits, fork.before.warmHits + 1);
  });
});

// The generation coordinator (c0-brief §3, binding structure): one
// coordinator per environment; publish-in-flight before descent; cancelled
// generations never commit; warm = epoch equality (never per-hit
// re-resolve); selective invalidation through a reverse index (class W1);
// config-epoch abandon (class W2); compiler-cache-wipe coupling (class W4);
// route fan-out untouched (class W3 — nothing here subscribes to it).
// The cache is coordinator-PRIVATE: never bundler module meta, never the
// SSR↔browser ReadOncePersistedStore.
import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";

import type {
  FinalizedSet,
  PlanResolver,
  PreliminaryUpdatePlans,
} from "./finalize";
import { finalizeSet } from "./finalize";
import type { FinalizedPlan } from "./finalized-plan";
import type { PartitionPublicationToken, PartitionState } from "./partition";
import { PartitionStore, type PartitionStoreStats } from "./partition-store";

export type PlanEnv = "ssr" | "client";

/** A cancelled generation: the finalize work was abandoned (W1/W2/W4 while
 * in flight) and MUST NOT commit a fingerprint. */
export class CancelledError extends Error {
  constructor(reason: string) {
    super(`persisted plan finalize cancelled: ${reason}`);
    this.name = "CancelledError";
  }
}

/** Intake handed by the harvest point (the `@marko/vite` transform). */
export interface PlanIntake {
  /** The compiled module's file id (the importer). */
  id: string;
  /** `metadata.marko.updatePlan`; ABSENT under suppression or a
   * non-persisted compile — absence means print, never error (§1.5). */
  carrier: PreliminaryUpdatePlans | undefined;
  /** Resolver wrapping the calling hook's `this.resolve` (raw identity
   * path; never re-enters the coordinator). */
  resolver: PlanResolver;
  /** Raw spelling of the module's own plain template (module-state). */
  selfPlainRaw?: string;
  resolverConfigTag?: string;
}

export interface GenerationStats {
  finalizeStarts: number;
  finalizeCommits: number;
  warmHits: number;
  cancels: number;
  selectiveInvalidations: number;
  epochBumps: number;
  configEpochBumps: number;
  negativeEntries: number;
  committedEntries: number;
  inFlight: number;
  reverseFiles: number;
  reverseRefs: number;
  retainedPlanBytes: number;
  auditStarts: number;
  auditResolves: number;
  auditFailures: number;
}

export function preliminaryKey(carrier: PreliminaryUpdatePlans): string {
  return (
    carrier.entry.importer +
    "\0" +
    crypto
      .createHash("sha256")
      .update(JSON.stringify(carrier))
      .digest("hex")
      .slice(0, 32)
  );
}

interface InFlight {
  promise: Promise<FinalizedSet>;
  token: { cancelled: boolean; reason: string };
  configEpoch: string;
  epoch: number;
}

interface Committed {
  set: FinalizedSet;
  importerId: string;
  configEpoch: string;
  epoch: number;
}

export interface AuditMismatch {
  plan: string;
  specifier: string;
  expected: {
    canonical: string;
    virtualContentHash?: string;
  };
  actual: {
    canonical: string;
    virtualContentHash?: string;
  };
}

export interface AuditResult {
  valid: boolean;
  checked: number;
  mismatches: AuditMismatch[];
}

/** Marks the async extent of a finalize (module-wide on purpose: a nested
 * generation is illegal across coordinators too). */
const finalizeContext = new AsyncLocalStorage<{ env: PlanEnv }>();

/** Strips query/hash so watcher file paths and canonical ids meet on one
 * reverse-index key. */
function fileKey(idOrPath: string): string {
  return idOrPath.split("?")[0].split("#")[0];
}

export class PlanCoordinator {
  readonly env: PlanEnv;
  private epoch = 0;
  private configEpoch = "";
  private inFlight = new Map<string, InFlight>();
  private committed = new Map<string, Committed>();
  private byFingerprint = new Map<string, FinalizedPlan>();
  /** Suppression = short-lived negative entry keyed importer id; any
   * carrier reappearance or epoch change retries (Rule 7). */
  private negatives = new Map<string, { epoch: number }>();
  /** canonical-or-file → prelimKeys that consumed it (Rule 6). */
  private reverse = new Map<string, Set<string>>();
  /** prelimKey → reverse files, for complete pruning on selective drop. */
  private reverseByKey = new Map<string, Set<string>>();
  /** prelimKeys per importer id (suppression transitions evict, F3). */
  private byImporter = new Map<string, Set<string>>();
  private stats = {
    finalizeStarts: 0,
    finalizeCommits: 0,
    warmHits: 0,
    cancels: 0,
    selectiveInvalidations: 0,
    epochBumps: 0,
    configEpochBumps: 0,
    auditStarts: 0,
    auditResolves: 0,
    auditFailures: 0,
  };

  constructor(env: PlanEnv) {
    this.env = env;
  }

  /** The single entry point (host API). Returns the finalized set, or null
   * when the carrier is absent (suppression → print path, no entry). */
  ensureFinalized(intake: PlanIntake): Promise<FinalizedSet | null> {
    if (finalizeContext.getStore()) {
      // Rule 3: a nested GENERATION is structurally impossible — resolving
      // plan targets during finalize uses the raw identity path only.
      // Nested-ness is tracked through the ASYNC call stack (never a plain
      // counter): concurrent top-level transforms are the vite norm and
      // MUST proceed, while a resolver that re-enters mid-finalize — in
      // any env — is refused.
      throw new Error(
        `persisted plan coordinator (${this.env}): re-entrant ensureFinalized during finalize of another plan`,
      );
    }
    const { carrier } = intake;
    if (!carrier) {
      // Published → suppressed: evict every finalized entry for this
      // importer (F3 — no stale plan may outlive its publication).
      this.evictImporter(intake.id);
      this.negatives.set(intake.id, { epoch: this.epoch });
      return Promise.resolve(null);
    }
    // Suppressed → published: drop the negative and finalize (F2).
    this.negatives.delete(intake.id);

    const key = preliminaryKey(carrier);
    const warm = this.committed.get(key);
    if (
      warm &&
      warm.epoch === this.epoch &&
      warm.configEpoch === this.configEpoch
    ) {
      // Warm fast path: epoch equality, ZERO re-resolves (schema-Q6).
      this.stats.warmHits++;
      return Promise.resolve(warm.set);
    }
    const open = this.inFlight.get(key);
    if (open && open.epoch === this.epoch && !open.token.cancelled) {
      // Single-flight: concurrent requests share the promise (Rule 1).
      return open.promise;
    }

    const token = { cancelled: false, reason: "" };
    const startEpoch = this.epoch;
    const startConfigEpoch = this.configEpoch;
    this.stats.finalizeStarts++;
    const promise = this.runFinalize(
      intake,
      carrier,
      key,
      token,
      startEpoch,
      startConfigEpoch,
    );
    // Publish-in-flight BEFORE any await (Rule 2): cycles become shared
    // promises, not mutual awaits.
    this.inFlight.set(key, {
      promise,
      token,
      epoch: startEpoch,
      configEpoch: startConfigEpoch,
    });
    // The in-flight job is W1-discoverable through its own source files
    // even before any dep is recorded (an edit mid-finalize must cancel).
    this.indexDep(fileKey(intake.id), key);
    this.indexDep(fileKey(carrier.entry.originFile), key);
    return promise;
  }

  private async runFinalize(
    intake: PlanIntake,
    carrier: PreliminaryUpdatePlans,
    key: string,
    token: { cancelled: boolean; reason: string },
    startEpoch: number,
    startConfigEpoch: string,
  ): Promise<FinalizedSet> {
    let set: FinalizedSet;
    try {
      set = await finalizeContext.run({ env: this.env }, () =>
        finalizeSet(carrier, {
          resolver: intake.resolver,
          selfPlainRaw: intake.selfPlainRaw,
          selfContext: intake.id,
          resolverConfigTag: intake.resolverConfigTag,
        }),
      );
    } catch (err) {
      this.dropIndex(key);
      throw err;
    } finally {
      if (this.inFlight.get(key)?.token === token) {
        this.inFlight.delete(key);
      }
    }
    if (
      token.cancelled ||
      startEpoch !== this.epoch ||
      startConfigEpoch !== this.configEpoch
    ) {
      // A cancelled/abandoned generation NEVER writes a fingerprint to the
      // durable cache (Rule 4 cancel protocol).
      this.dropIndex(key);
      throw new CancelledError(
        token.reason || "generation superseded during finalize",
      );
    }
    this.commit(intake.id, key, set);
    return set;
  }

  private commit(importerId: string, key: string, set: FinalizedSet) {
    this.stats.finalizeCommits++;
    this.committed.set(key, {
      set,
      importerId,
      epoch: this.epoch,
      configEpoch: this.configEpoch,
    });
    let importerKeys = this.byImporter.get(importerId);
    if (!importerKeys)
      this.byImporter.set(importerId, (importerKeys = new Set()));
    importerKeys.add(key);
    for (const plan of set.plans) {
      this.byFingerprint.set(plan.fingerprint, plan);
      for (const dep of plan.resolutionDeps) {
        this.indexDep(fileKey(dep.canonical), key);
      }
      this.indexDep(fileKey(plan.originFile), key);
    }
  }

  private indexDep(file: string, key: string) {
    let keys = this.reverse.get(file);
    if (!keys) this.reverse.set(file, (keys = new Set()));
    keys.add(key);
    let files = this.reverseByKey.get(key);
    if (!files) this.reverseByKey.set(key, (files = new Set()));
    files.add(file);
  }

  private dropIndex(key: string) {
    const files = this.reverseByKey.get(key);
    if (!files) return;
    this.reverseByKey.delete(key);
    for (const file of files) {
      const keys = this.reverse.get(file);
      if (!keys) continue;
      keys.delete(key);
      if (!keys.size) this.reverse.delete(file);
    }
  }

  /** Class W1: a changed file invalidates its reverse set ONLY — never the
   * whole cache. A file no plan consumed (route handlers, middleware — the
   * class-W3 fan-out surface) touches nothing. */
  handleFileChange(file: string): number {
    const key = fileKey(file);
    const keys = this.reverse.get(key);
    if (!keys?.size) return 0;
    this.reverse.delete(key);
    let invalidated = 0;
    for (const prelimKey of keys) {
      if (this.dropCommitted(prelimKey)) invalidated++;
      const open = this.inFlight.get(prelimKey);
      if (open && !open.token.cancelled) {
        open.token.cancelled = true;
        open.token.reason = `file changed during finalize: ${file}`;
        this.stats.cancels++;
      }
    }
    this.stats.selectiveInvalidations += invalidated;
    return invalidated;
  }

  /** Class W2: resolver-relevant config changed — env-wide abandon of warm
   * entries and in-flight work; no per-dep re-resolve involved. */
  setConfigEpoch(hash: string) {
    if (hash === this.configEpoch) return;
    this.configEpoch = hash;
    this.stats.configEpochBumps++;
    this.abandonAll(`configEpoch changed to ${hash}`);
  }

  /** Class W4: a global compiler-cache wipe shares a generation boundary
   * with the plan cache (Rule 10) — full cold path accepted. */
  bumpEpoch(reason = "compiler cache wiped") {
    this.epoch++;
    this.stats.epochBumps++;
    this.abandonAll(reason);
  }

  private abandonAll(reason: string) {
    for (const open of this.inFlight.values()) {
      if (!open.token.cancelled) {
        open.token.cancelled = true;
        open.token.reason = reason;
        this.stats.cancels++;
      }
    }
    this.committed.clear();
    this.byFingerprint.clear();
    this.byImporter.clear();
    this.reverse.clear();
    this.reverseByKey.clear();
    this.negatives.clear();
  }

  private evictImporter(importerId: string) {
    const keys = this.byImporter.get(importerId);
    if (!keys) return;
    this.byImporter.delete(importerId);
    for (const key of keys) this.dropCommitted(key);
  }

  private dropCommitted(key: string): boolean {
    const entry = this.committed.get(key);
    if (!entry) return false;
    this.committed.delete(key);
    this.dropIndex(key);
    const importerKeys = this.byImporter.get(entry.importerId);
    if (importerKeys) {
      importerKeys.delete(key);
      if (!importerKeys.size) this.byImporter.delete(entry.importerId);
    }
    for (const plan of entry.set.plans) {
      this.byFingerprint.delete(plan.fingerprint);
    }
    return true;
  }

  getByFingerprint(fingerprint: string): FinalizedPlan | undefined {
    return this.byFingerprint.get(fingerprint);
  }

  /** Current-generation atomic sets only. This is the C1 seal universe;
   * callers never reconstruct it from transform-side fingerprint records. */
  snapshotCommitted(): readonly FinalizedSet[] {
    return [...this.committed.values()]
      .filter(
        (entry) =>
          entry.epoch === this.epoch && entry.configEpoch === this.configEpoch,
      )
      .map((entry) => entry.set)
      .sort((a, b) =>
        a.entry.moduleKey < b.entry.moduleKey
          ? -1
          : a.entry.moduleKey > b.entry.moduleKey
            ? 1
            : 0,
      );
  }

  getPublicationToken(): PartitionPublicationToken {
    return { epoch: this.epoch, configEpoch: this.configEpoch };
  }

  /** Explicit AUDIT slow path (never called by ensureFinalized): re-resolve
   * every recorded outcome for one warm entry and compare it without
   * mutating or accepting the cache entry. */
  async auditWarmEntry(intake: PlanIntake): Promise<AuditResult> {
    if (!intake.carrier) {
      throw new Error("persisted plan AUDIT requires a published carrier");
    }
    const key = preliminaryKey(intake.carrier);
    const warm = this.committed.get(key);
    if (
      !warm ||
      warm.epoch !== this.epoch ||
      warm.configEpoch !== this.configEpoch
    ) {
      throw new Error("persisted plan AUDIT requires a current warm entry");
    }

    this.stats.auditStarts++;
    const mismatches: AuditMismatch[] = [];
    let checked = 0;
    for (const plan of warm.set.plans) {
      for (const expected of plan.resolutionDeps) {
        const attributes = (
          JSON.parse(expected.attrsKey) as [key: string, value: string][]
        ).map(([key, value]) => ({ key, value, quoted: true }));
        const { dep: actual } = await intake.resolver.resolveId(
          expected.specifier,
          expected.importer,
          attributes,
        );
        checked++;
        this.stats.auditResolves++;
        if (
          actual.canonical !== expected.canonical ||
          actual.virtualContentHash !== expected.virtualContentHash
        ) {
          mismatches.push({
            plan: plan.moduleKey,
            specifier: expected.specifier,
            expected: {
              canonical: expected.canonical,
              ...(expected.virtualContentHash !== undefined
                ? { virtualContentHash: expected.virtualContentHash }
                : null),
            },
            actual: {
              canonical: actual.canonical,
              ...(actual.virtualContentHash !== undefined
                ? { virtualContentHash: actual.virtualContentHash }
                : null),
            },
          });
        }
      }
    }
    if (mismatches.length) this.stats.auditFailures++;
    return { valid: !mismatches.length, checked, mismatches };
  }

  getGenerationStats(): GenerationStats {
    let reverseRefs = 0;
    for (const keys of this.reverse.values()) reverseRefs += keys.size;
    let retainedPlanBytes = 0;
    for (const entry of this.committed.values()) {
      retainedPlanBytes += Buffer.byteLength(JSON.stringify(entry.set));
    }
    return {
      ...this.stats,
      negativeEntries: this.negatives.size,
      committedEntries: this.committed.size,
      inFlight: this.inFlight.size,
      reverseFiles: this.reverse.size,
      reverseRefs,
      retainedPlanBytes,
    };
  }
}

/** The narrow host API `@marko/vite` calls into (brief §8.8, minimal —
 * plus the lifecycle couplings the taxonomy requires). NO module-meta
 * fingerprint pointer exists (§7.11 hard-defer). */
export interface PersistedPlanHost {
  ensureFinalized(
    intake: PlanIntake & { env: PlanEnv },
  ): Promise<FinalizedSet | null>;
  getByFingerprint(
    fingerprint: string,
    env: PlanEnv,
  ): FinalizedPlan | undefined;
  getGenerationStats(): Record<PlanEnv, GenerationStats>;
  /** C1 seal source: current epoch×configEpoch atomic finalized sets. */
  snapshotCommitted(env: PlanEnv): readonly FinalizedSet[];
  /** Resolver-owned virtual source bytes captured during finalization. */
  noteVirtualSource(
    env: PlanEnv,
    canonical: string,
    source: string | undefined,
  ): void;
  snapshotVirtualSources(env: PlanEnv): ReadonlyMap<string, string | undefined>;
  getPublicationToken(env: PlanEnv): PartitionPublicationToken;
  notePartitionRoutes(routes: readonly PartitionSealRoute[]): void;
  sealPartition(
    routes: readonly PartitionSealRoute[],
    mode: PartitionSealMode,
  ): PartitionSealResult;
  getPublishedPartition(): PartitionState | undefined;
  getPartitionStats(): PartitionStoreStats;
  /** Class W4 coupling: `@marko/vite`'s hotUpdate global compiler-cache
   * clear must bump the plan generation. */
  onCompilerCacheWipe(): void;
  /** Class W1 channel (watcher wiring). */
  handleFileChange(file: string): void;
  /** Class W2 channel (configResolved / config mutation). */
  setConfigEpoch(hash: string): void;
}

export type PartitionSealMode = "build" | "dev";

export interface PartitionSealRoute {
  routeIndex: number;
  templateFilePath: string;
  /** Test/C2 seam for a route whose resolver identity is already known.
   * Production plugin orchestration resolves from the committed entry. */
  entryModuleKey?: string;
}

export interface PartitionSealResult {
  state: PartitionState | undefined;
  dirty: boolean;
  missingRoutes: { routeIndex: number; templateFilePath: string }[];
}

/** Single canonicalizer for entry/module keys (cutover merge map write+read). */
export function normalizedEntrySpelling(id: string): string {
  return id
    .split("?")[0]
    .split("#")[0]
    .replace(/\\/g, "/")
    .replace(/\.persisted-entry\.marko$/, ".marko");
}

function setMatchesRoute(set: FinalizedSet, templateFilePath: string): boolean {
  const routeSpelling = normalizedEntrySpelling(templateFilePath);
  return [set.entry.importer, set.entry.originFile, set.entry.moduleKey].some(
    (candidate) => normalizedEntrySpelling(candidate) === routeSpelling,
  );
}

export function createPersistedPlanHost(): PersistedPlanHost {
  const coordinators: Record<PlanEnv, PlanCoordinator> = {
    ssr: new PlanCoordinator("ssr"),
    client: new PlanCoordinator("client"),
  };
  const partitionStore = new PartitionStore();
  const virtualSources: Record<PlanEnv, Map<string, string | undefined>> = {
    ssr: new Map(),
    client: new Map(),
  };
  let partitionRouteSignature: string | undefined;
  return {
    async ensureFinalized({ env, ...intake }) {
      // envKey is part of every lookup by construction: separate
      // coordinators per environment (D1/D3 — a mismatch is a hard miss).
      const before = coordinators[env].getGenerationStats();
      const result = await coordinators[env].ensureFinalized(intake);
      const after = coordinators[env].getGenerationStats();
      // Publication invalidation is coupled to the same client commit/evict
      // operation; this never computes a partition in the warm path.
      if (
        env === "client" &&
        (after.finalizeCommits !== before.finalizeCommits ||
          after.committedEntries !== before.committedEntries)
      ) {
        partitionStore.invalidate();
      }
      return result;
    },
    getByFingerprint(fingerprint, env) {
      return coordinators[env].getByFingerprint(fingerprint);
    },
    getGenerationStats() {
      return {
        ssr: coordinators.ssr.getGenerationStats(),
        client: coordinators.client.getGenerationStats(),
      };
    },
    snapshotCommitted(env) {
      return coordinators[env].snapshotCommitted();
    },
    noteVirtualSource(env, canonical, source) {
      virtualSources[env].set(canonical, source);
    },
    snapshotVirtualSources(env) {
      return new Map(virtualSources[env]);
    },
    getPublicationToken(env) {
      return coordinators[env].getPublicationToken();
    },
    notePartitionRoutes(routes) {
      const nextSignature = JSON.stringify(
        [...routes]
          .map(({ routeIndex, templateFilePath }) => [
            routeIndex,
            normalizedEntrySpelling(templateFilePath),
          ])
          .sort(
            (a, b) =>
              Number(a[0]) - Number(b[0]) ||
              String(a[1]).localeCompare(String(b[1])),
          ),
      );
      if (
        partitionRouteSignature !== undefined &&
        nextSignature !== partitionRouteSignature
      ) {
        partitionStore.invalidate();
      }
      partitionRouteSignature = nextSignature;
    },
    sealPartition(routes, mode) {
      const sets = coordinators.client.snapshotCommitted();
      const partitionRoutes = [];
      const missingRoutes = [];
      for (const route of routes) {
        const matches = route.entryModuleKey
          ? sets.filter((set) => set.entry.moduleKey === route.entryModuleKey)
          : sets.filter((set) => setMatchesRoute(set, route.templateFilePath));
        const entryModuleKeys = [
          ...new Set(matches.map((set) => set.entry.moduleKey)),
        ];
        if (entryModuleKeys.length !== 1) {
          missingRoutes.push({
            routeIndex: route.routeIndex,
            templateFilePath: route.templateFilePath,
          });
          continue;
        }
        partitionRoutes.push({
          routeIndex: route.routeIndex,
          entryModuleKey: entryModuleKeys[0],
        });
      }

      if (missingRoutes.length) {
        partitionStore.invalidate();
        if (mode === "build") {
          const details = missingRoutes
            .map(
              (route) =>
                `route ${route.routeIndex} (${route.templateFilePath})`,
            )
            .join(", ");
          throw new Error(
            `persisted partition build seal incomplete: missing committed client FinalizedSet for ${details}`,
          );
        }
        return { state: undefined, dirty: true, missingRoutes };
      }

      const plans = sets.flatMap((set) => set.plans);
      const state = partitionStore.ensure({
        plans,
        routes: partitionRoutes,
        publicationToken: coordinators.client.getPublicationToken(),
      });
      return { state, dirty: false, missingRoutes: [] };
    },
    getPublishedPartition() {
      return partitionStore.getPublished(
        coordinators.client.getPublicationToken(),
      );
    },
    getPartitionStats() {
      return partitionStore.getStats();
    },
    onCompilerCacheWipe() {
      coordinators.ssr.bumpEpoch();
      coordinators.client.bumpEpoch();
      virtualSources.ssr.clear();
      virtualSources.client.clear();
      partitionStore.invalidate();
    },
    handleFileChange(file) {
      coordinators.ssr.handleFileChange(file);
      if (coordinators.client.handleFileChange(file)) {
        partitionStore.invalidate();
      }
    },
    setConfigEpoch(hash) {
      const before = coordinators.client.getPublicationToken();
      coordinators.ssr.setConfigEpoch(hash);
      coordinators.client.setConfigEpoch(hash);
      const after = coordinators.client.getPublicationToken();
      if (after.configEpoch !== before.configEpoch) {
        virtualSources.ssr.clear();
        virtualSources.client.clear();
        partitionStore.invalidate();
      }
    },
  };
}

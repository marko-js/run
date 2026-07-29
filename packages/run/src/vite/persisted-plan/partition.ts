import crypto from "crypto";

import type { FinalizedPlan } from "./finalized-plan";

export const PARTITION_STATE_VERSION = "partition-state@1";

export interface PartitionPublicationToken {
  epoch: number;
  configEpoch: string;
}

export interface PartitionRoute {
  routeIndex: number;
  entryModuleKey: string;
}

export interface PartitionInput {
  plans: readonly FinalizedPlan[];
  routes: readonly PartitionRoute[];
  publicationToken: PartitionPublicationToken;
}

export interface PartitionRoot {
  rootId: string;
  kind: "eager-route" | "lazy-boundary";
  moduleKey: string;
  routeIndexes?: number[];
}

export interface PartitionCell {
  cellId: string;
  rootSet: string[];
  moduleKeys: string[];
  routeIncidence: number[];
  capabilityShellIds: string[];
}

export interface PartitionRouteProjection {
  eagerCellIds: string[];
  possessionShellIds: string[];
}

export interface PartitionState {
  schemaVersion: typeof PARTITION_STATE_VERSION;
  inputFingerprint: string;
  publicationToken: PartitionPublicationToken;
  roots: PartitionRoot[];
  cells: PartitionCell[];
  moduleCellIds: Record<string, string>;
  routeProjections: Record<string, PartitionRouteProjection>;
  lazyRootCellIds: Record<string, string>;
}

const syncKinds = new Set([
  "internalized-child",
  "load-edge-child",
  "module-state",
]);

function compareString(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isHostPlanVirtual(plan: FinalizedPlan) {
  return (
    plan.resolutionDeps.some(
      (dep) =>
        dep.canonical === plan.moduleKey &&
        dep.virtualContentHash !== undefined,
    ) ||
    plan.originFile.replace(/\\/g, "/") !==
      plan.moduleKey.split("?")[0].replace(/\\/g, "/")
  );
}

function compareRoute(a: PartitionRoute, b: PartitionRoute) {
  return (
    a.routeIndex - b.routeIndex ||
    compareString(a.entryModuleKey, b.entryModuleKey)
  );
}

/** Canonical JSON for hashes, byte comparisons, and the C2 handoff. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort(compareString)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Content identity only: generation epoch and configEpoch deliberately stay
 * out of this hash and are checked separately as the publication token.
 */
export function fingerprintPartitionInput(
  input: Pick<PartitionInput, "plans" | "routes">,
): string {
  const planFingerprints = [
    ...new Set(input.plans.map((plan) => plan.fingerprint)),
  ].sort(compareString);
  const routes = [...input.routes]
    .sort(compareRoute)
    .map(({ routeIndex, entryModuleKey }) => [routeIndex, entryModuleKey]);
  return crypto
    .createHash("sha256")
    .update(canonicalJson({ planFingerprints, routes }))
    .digest("hex");
}

/**
 * A cell id is a collision-safe encoding of the complete activation-root
 * set. It contains resolver module keys only: no plan/content fingerprint,
 * route path spelling, epoch, or config epoch.
 */
function cellIdOf(rootSet: readonly string[]): string {
  return `cell:${JSON.stringify(rootSet)}`;
}

function closure(
  start: string,
  adjacency: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const seen = new Set<string>();
  const pending = [start];
  while (pending.length) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const target of adjacency.get(current) ?? []) {
      if (!seen.has(target)) pending.push(target);
    }
  }
  return seen;
}

function addAll<T>(target: Set<T>, source: Iterable<T>): boolean {
  let changed = false;
  for (const value of source) {
    if (!target.has(value)) {
      target.add(value);
      changed = true;
    }
  }
  return changed;
}

function sortedRecord<T>(
  entries: Iterable<readonly [string, T]>,
): Record<string, T> {
  return Object.fromEntries(
    [...entries].sort(([a], [b]) => compareString(a, b)),
  );
}

export function computePartition(input: PartitionInput): PartitionState {
  const plansByModule = new Map<string, FinalizedPlan>();
  for (const plan of input.plans) {
    const existing = plansByModule.get(plan.moduleKey);
    if (existing && existing.fingerprint !== plan.fingerprint) {
      throw new Error(
        `persisted partition: conflicting finalized plans for moduleKey ${JSON.stringify(plan.moduleKey)}`,
      );
    }
    plansByModule.set(plan.moduleKey, plan);
  }

  const routes = [...input.routes].sort(compareRoute);
  const routeByIndex = new Map<number, PartitionRoute>();
  for (const route of routes) {
    const existing = routeByIndex.get(route.routeIndex);
    if (existing && existing.entryModuleKey !== route.entryModuleKey) {
      throw new Error(
        `persisted partition: route ${route.routeIndex} has multiple entry moduleKeys`,
      );
    }
    if (!plansByModule.has(route.entryModuleKey)) {
      throw new Error(
        `persisted partition: route ${route.routeIndex} entry ${JSON.stringify(route.entryModuleKey)} is outside the finalized universe`,
      );
    }
    routeByIndex.set(route.routeIndex, route);
  }

  const sync = new Map<string, string[]>();
  const lazyEdges = new Map<string, string[]>();
  const lazyRootKeys = new Set<string>();
  for (const [moduleKey, plan] of plansByModule) {
    const syncTargets = new Set<string>();
    const lazyTargets = new Set<string>();
    const demandTargets = new Set<string>();
    for (const loader of plan.loaders) {
      for (const target of loader.targets) {
        const targetPlan = plansByModule.get(target.canonical);
        // Scheduled readiness is not generally a demand root (C1-Root1).
        // A compiler-supplied plan virtual is different: it is the actual
        // setup module fetched by the ready chain and must be loadable from
        // the artifact graph. Resolver-recorded virtual content, rather than
        // a path spelling, identifies that host-owned class.
        const scheduledPlanVirtual =
          loader.targetKind === "scheduled-load-ready" &&
          targetPlan &&
          isHostPlanVirtual(targetPlan);
        if (
          targetPlan &&
          (loader.targetKind !== "scheduled-load-ready" || scheduledPlanVirtual)
        ) {
          demandTargets.add(target.canonical);
          lazyRootKeys.add(target.canonical);
        }
      }
    }
    for (const request of plan.requestedModules) {
      if (!plansByModule.has(request.canonical)) continue;
      if (syncKinds.has(request.kind)) {
        syncTargets.add(request.canonical);
      } else if (
        request.kind === "lazy-edge" &&
        demandTargets.has(request.canonical)
      ) {
        lazyTargets.add(request.canonical);
      }
    }
    sync.set(moduleKey, [...syncTargets].sort(compareString));
    lazyEdges.set(moduleKey, [...lazyTargets].sort(compareString));
  }

  const eagerRoutesByRoot = new Map<string, Set<number>>();
  for (const route of routeByIndex.values()) {
    let indexes = eagerRoutesByRoot.get(route.entryModuleKey);
    if (!indexes) {
      eagerRoutesByRoot.set(route.entryModuleKey, (indexes = new Set()));
    }
    indexes.add(route.routeIndex);
  }

  // Root identity is the resolver moduleKey. If one module is both a page
  // entry and a demand target it is one activation root; eager-route wins the
  // representational kind and its direct route indexes remain explicit.
  const rootKeys = new Set([...eagerRoutesByRoot.keys(), ...lazyRootKeys]);
  const rootClosures = new Map<string, Set<string>>();
  for (const rootKey of rootKeys) {
    rootClosures.set(rootKey, closure(rootKey, sync));
  }

  const rootsByModule = new Map<string, Set<string>>();
  const routesByModule = new Map<string, Set<number>>();
  for (const moduleKey of plansByModule.keys()) {
    rootsByModule.set(moduleKey, new Set());
    routesByModule.set(moduleKey, new Set());
  }
  for (const [rootKey, members] of rootClosures) {
    for (const member of members) rootsByModule.get(member)!.add(rootKey);
  }
  for (const [rootKey, routeIndexes] of eagerRoutesByRoot) {
    for (const member of rootClosures.get(rootKey)!) {
      addAll(routesByModule.get(member)!, routeIndexes);
    }
  }

  // Lazy route incidence is a finite monotone fixed point. Loader records
  // mint demand roots; requested lazy-edge events are the sole propagation
  // edges. Loader targets are intentionally not walked a second time.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [source, targets] of lazyEdges) {
      const sourceRoutes = routesByModule.get(source)!;
      if (!sourceRoutes.size) continue;
      for (const target of targets) {
        if (!lazyRootKeys.has(target)) continue;
        for (const member of rootClosures.get(target)!) {
          changed =
            addAll(routesByModule.get(member)!, sourceRoutes) || changed;
        }
      }
    }
  }

  const cellsById = new Map<
    string,
    {
      rootSet: string[];
      moduleKeys: Set<string>;
      routeIncidence: Set<number>;
      capabilityShellIds: Set<string>;
    }
  >();
  const moduleCellIds = new Map<string, string>();
  for (const moduleKey of [...plansByModule.keys()].sort(compareString)) {
    const rootSet = [...rootsByModule.get(moduleKey)!].sort(compareString);
    const cellId = cellIdOf(rootSet);
    let cell = cellsById.get(cellId);
    if (!cell) {
      cellsById.set(
        cellId,
        (cell = {
          rootSet,
          moduleKeys: new Set(),
          routeIncidence: new Set(),
          capabilityShellIds: new Set(),
        }),
      );
    }
    cell.moduleKeys.add(moduleKey);
    addAll(cell.routeIncidence, routesByModule.get(moduleKey)!);
    for (const shell of plansByModule.get(moduleKey)!.shellCapability.shells) {
      cell.capabilityShellIds.add(shell.shellId);
    }
    moduleCellIds.set(moduleKey, cellId);
  }

  const cells: PartitionCell[] = [...cellsById]
    .sort(([a], [b]) => compareString(a, b))
    .map(([cellId, cell]) => ({
      cellId,
      rootSet: cell.rootSet,
      moduleKeys: [...cell.moduleKeys].sort(compareString),
      routeIncidence: [...cell.routeIncidence].sort((a, b) => a - b),
      capabilityShellIds: [...cell.capabilityShellIds].sort(compareString),
    }));

  const routeProjections = new Map<string, PartitionRouteProjection>();
  for (const route of routeByIndex.values()) {
    const eagerMembers = rootClosures.get(route.entryModuleKey)!;
    const eagerCellIds = new Set<string>();
    const possessionShellIds = new Set<string>();
    for (const member of eagerMembers) {
      eagerCellIds.add(moduleCellIds.get(member)!);
      addAll(
        possessionShellIds,
        plansByModule.get(member)!.shellPossession.claimable,
      );
    }
    routeProjections.set(String(route.routeIndex), {
      eagerCellIds: [...eagerCellIds].sort(compareString),
      possessionShellIds: [...possessionShellIds].sort(compareString),
    });
  }

  const roots: PartitionRoot[] = [...rootKeys]
    .sort(compareString)
    .map((moduleKey) => {
      const eagerRoutes = eagerRoutesByRoot.get(moduleKey);
      return eagerRoutes
        ? {
            rootId: moduleKey,
            kind: "eager-route" as const,
            moduleKey,
            routeIndexes: [...eagerRoutes].sort((a, b) => a - b),
          }
        : {
            rootId: moduleKey,
            kind: "lazy-boundary" as const,
            moduleKey,
          };
    });

  const lazyRootCellIds = new Map<string, string>();
  for (const moduleKey of [...lazyRootKeys].sort(compareString)) {
    lazyRootCellIds.set(moduleKey, moduleCellIds.get(moduleKey)!);
  }

  return {
    schemaVersion: PARTITION_STATE_VERSION,
    inputFingerprint: fingerprintPartitionInput(input),
    publicationToken: { ...input.publicationToken },
    roots,
    cells,
    moduleCellIds: sortedRecord(moduleCellIds),
    routeProjections: sortedRecord(routeProjections),
    lazyRootCellIds: sortedRecord(lazyRootCellIds),
  };
}

export function serializePartitionState(
  state: PartitionState,
  includePublicationToken = true,
): string {
  if (includePublicationToken) return canonicalJson(state);
  const { publicationToken: _publicationToken, ...content } = state;
  return canonicalJson(content);
}

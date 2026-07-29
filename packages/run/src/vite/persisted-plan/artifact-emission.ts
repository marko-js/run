import crypto from "crypto";
import path from "path";

import type { FinalizedPlan } from "./finalized-plan";
import type { PartitionState } from "./partition";

const ARTIFACT_FORMAT_VERSION = "cell-artifact@3";
export const ARTIFACT_VIRTUAL_PREFIX = "virtual:marko-run/artifact/";
export const ARTIFACT_IMPORT_PREFIX = "virtual:marko-run/a/";
export const ORDINARY_VIRTUAL_PREFIX = "virtual:marko-run/ordinary/";

type RequestAttr =
  FinalizedPlan["requestedModules"][number]["attributes"][number];

export class EmitRejection extends Error {
  code: "late-external-after-body" | "circular-reexport";
  module: string;
  ordinal: number;
  canonical: string;

  constructor(
    code: EmitRejection["code"],
    module: string,
    ordinal: number,
    canonical: string,
    detail: string,
  ) {
    super(`[${code}] ${module}@${ordinal} -> "${canonical}": ${detail}`);
    this.name = "EmitRejection";
    this.code = code;
    this.module = module;
    this.ordinal = ordinal;
    this.canonical = canonical;
  }
}

export interface ArtifactManifest {
  rootModuleKey: string;
  schedule: string[];
  cycles: string[][];
  imports: {
    canonical: string;
    emitted: string;
    names: { imported: string; local: string }[];
    namespace?: string;
    bare: boolean;
  }[];
  droppedResidue: string[];
}

export interface EmittedArtifact {
  publicId: string;
  virtualId: string;
  cellId: string;
  rootModuleKey: string;
  moduleKeys: string[];
  capabilityShellIds: string[];
  source: string;
  manifest: ArtifactManifest;
}

export interface EmittedArtifactFacade {
  publicId: string;
  virtualId: string;
  artifactPublicId: string;
  moduleKey: string;
  source: string;
}

export interface EmittedArtifactAlias {
  virtualId: string;
  targetVirtualId: string;
}

export interface EmittedOrdinaryPassthrough {
  canonical: string;
  virtualId: string;
  requestingModule: string;
  source?: string;
}

export interface ArtifactCapability {
  shellIds: string[];
  /** Sparse rows: [artifact index, ...interned shell indexes]. */
  artifacts: number[][];
}

export interface ArtifactRoute {
  routeIndex: number;
  primaryArtifactIndex: number;
  primaryRegistryIndex: number;
  eagerArtifactIndexes: number[];
  eagerArtifactIds: string[];
  possessionShellIndexes: number[];
}

export interface ArtifactEmission {
  contentFingerprint: string;
  artifacts: EmittedArtifact[];
  facades: EmittedArtifactFacade[];
  lazyArtifacts: EmittedArtifact[];
  aliases: EmittedArtifactAlias[];
  passthroughs: EmittedOrdinaryPassthrough[];
  /** Dense route registry using short graph aliases. */
  registry: (string | null)[];
  capability: ArtifactCapability;
  routes: ArtifactRoute[];
  /**
   * moduleKey → artifact/facade virtual id for plan-only dual-entry stubs
   * and load-entry rewrites (side-effect import of merge registration).
   */
  mergeVirtualByModuleKey: Record<string, string>;
}

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

function hash(value: string, width = 12) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, width);
}

function dynamicImportLiterals(text: string) {
  const imports: { raw: string; start: number; end: number }[] = [];
  const pattern = /\bimport\s*\(\s*("(?:\\.|[^"\\])*")\s*\)/g;
  for (const match of text.matchAll(pattern)) {
    const literal = match[1];
    const start = match.index! + match[0].indexOf(literal);
    imports.push({
      raw: JSON.parse(literal),
      start,
      end: start + literal.length,
    });
  }
  return imports;
}

function resolveRegisteredOrdinary(
  plan: FinalizedPlan,
  raw: string,
  ordinaryVirtualSources: ReadonlyMap<string, string | undefined>,
) {
  const canonical =
    raw.startsWith(".") || raw.startsWith("/")
      ? path
          .resolve(path.dirname(plan.moduleKey.split("?")[0]), raw)
          .replace(/\\/g, "/")
      : raw;
  return ordinaryVirtualSources.has(canonical) ? canonical : undefined;
}

function requestIdentity(canonical: string, attributes: RequestAttr[]) {
  const pairs = attributes
    .map(({ key, value }) => [key, value] as const)
    .sort(([a], [b]) => compareString(a, b));
  return `${canonical}\0${JSON.stringify(pairs)}`;
}

function contentKey(
  inputFingerprint: string,
  cellId: string,
  moduleKeys: readonly string[],
  plansByModule: ReadonlyMap<string, FinalizedPlan>,
) {
  return JSON.stringify([
    ARTIFACT_FORMAT_VERSION,
    inputFingerprint,
    cellId,
    moduleKeys.map((moduleKey) => [
      moduleKey,
      plansByModule.get(moduleKey)?.fingerprint,
    ]),
  ]);
}

function emissionRoots(
  cell: PartitionState["cells"][number],
  plansByModule: ReadonlyMap<string, FinalizedPlan>,
) {
  const members = new Set(cell.moduleKeys);
  const targeted = new Set<string>();
  for (const moduleKey of cell.moduleKeys) {
    for (const request of plansByModule.get(moduleKey)!.requestedModules) {
      if (
        members.has(request.canonical) &&
        (request.kind === "internalized-child" ||
          request.kind === "load-edge-child")
      ) {
        targeted.add(request.canonical);
      }
    }
  }
  let roots = cell.moduleKeys
    .filter((moduleKey) => !targeted.has(moduleKey))
    .sort(compareString);
  // A cell may be one SCC, in which case every member has an inbound edge.
  if (!roots.length) roots = [cell.moduleKeys[0]];
  return roots;
}

/**
 * Membership and ownership come only from the sealed partition. Finalized
 * plans from that same generation supply module bodies, never a second plan.
 */
export function emitPartitionArtifacts(
  partition: PartitionState,
  plans: readonly FinalizedPlan[],
  ordinaryVirtualSources: ReadonlyMap<string, string | undefined> = new Map(),
): ArtifactEmission {
  const plansByModule = new Map(plans.map((plan) => [plan.moduleKey, plan]));
  const reachableCells = partition.cells
    .filter((cell) => cell.rootSet.length > 0)
    .sort((a, b) => compareString(a.cellId, b.cellId));
  const units: {
    cell: PartitionState["cells"][number];
    rootModuleKey: string;
    rootModuleKeys: string[];
    moduleKeys: string[];
    facadeModuleKeys: string[];
    capabilityShellIds: string[];
    publicId?: string;
  }[] = [];
  for (const cell of reachableCells) {
    for (const moduleKey of cell.moduleKeys) {
      if (!plansByModule.has(moduleKey)) {
        throw new Error(
          `@marko/run: artifact emission missing finalized plan for ${JSON.stringify(moduleKey)}`,
        );
      }
    }
    const roots = emissionRoots(cell, plansByModule);
    if (cell.rootSet.length === 1) {
      // Rev 1.2: a route-private cell is not a merge unit. Native static
      // imports preserve its module/SCC wiring and keep every external in the
      // module's prefix, while shared cells remain the cross-route dedup unit.
      const capabilityOwner = roots[0];
      for (const moduleKey of [...cell.moduleKeys].sort(compareString)) {
        units.push({
          cell,
          rootModuleKey: moduleKey,
          rootModuleKeys: [moduleKey],
          moduleKeys: [moduleKey],
          facadeModuleKeys: [],
          capabilityShellIds:
            moduleKey === capabilityOwner ? [...cell.capabilityShellIds] : [],
        });
      }
    } else {
      units.push({
        cell,
        rootModuleKey: roots[0],
        rootModuleKeys: roots,
        moduleKeys: [...cell.moduleKeys],
        facadeModuleKeys: [],
        capabilityShellIds: [...cell.capabilityShellIds],
      });
    }
  }
  const unitByModule = new Map<string, (typeof units)[number]>();
  for (const unit of units) {
    for (const moduleKey of unit.moduleKeys) unitByModule.set(moduleKey, unit);
  }
  for (const unit of units) {
    if (unit.rootModuleKeys.length > 1) {
      unit.facadeModuleKeys = [...unit.moduleKeys];
      continue;
    }
    unit.facadeModuleKeys = unit.moduleKeys.filter(
      (moduleKey) =>
        !unit.rootModuleKeys.includes(moduleKey) &&
        plans.some(
          (plan) =>
            unitByModule.get(plan.moduleKey) !== unit &&
            plan.requestedModules.some(
              (request) => request.canonical === moduleKey,
            ),
        ),
    );
  }

  const publicIdByModule = new Map<string, string>();
  const publicIdsByCell = new Map<string, string[]>();
  for (const unit of units) {
    const publicId = `a_${hash(
      contentKey(
        partition.inputFingerprint,
        unit.cell.cellId,
        unit.moduleKeys,
        plansByModule,
      ),
    )}`;
    unit.publicId = publicId;
    const cellIds = publicIdsByCell.get(unit.cell.cellId);
    if (cellIds) cellIds.push(publicId);
    else publicIdsByCell.set(unit.cell.cellId, [publicId]);
  }
  const facadeSpecs: {
    publicId: string;
    artifactPublicId: string;
    moduleKey: string;
  }[] = [];
  for (const unit of units) {
    if (unit.facadeModuleKeys.length) {
      for (const moduleKey of unit.moduleKeys) {
        if (!unit.facadeModuleKeys.includes(moduleKey)) {
          publicIdByModule.set(moduleKey, unit.publicId!);
          continue;
        }
        const publicId = `f_${hash(
          JSON.stringify([ARTIFACT_FORMAT_VERSION, unit.publicId, moduleKey]),
        )}`;
        publicIdByModule.set(moduleKey, publicId);
        facadeSpecs.push({
          publicId,
          artifactPublicId: unit.publicId!,
          moduleKey,
        });
      }
    } else {
      for (const moduleKey of unit.moduleKeys) {
        publicIdByModule.set(moduleKey, unit.publicId!);
      }
    }
  }
  const lazyPublicIdByModule = new Map<string, string>();
  for (const [moduleKey] of Object.entries(partition.lazyRootCellIds)) {
    const publicId = publicIdByModule.get(moduleKey);
    if (!publicId) {
      throw new Error(
        `@marko/run: lazy root ${JSON.stringify(moduleKey)} maps to no reachable emission unit`,
      );
    }
    lazyPublicIdByModule.set(moduleKey, publicId);
  }

  for (const plan of plans) {
    for (const loader of plan.loaders) {
      for (const target of loader.targets) {
        const targetPlan = plansByModule.get(target.canonical);
        const scheduledOrdinary =
          loader.targetKind === "scheduled-load-ready" &&
          targetPlan &&
          !isHostPlanVirtual(targetPlan);
        if (
          targetPlan &&
          !scheduledOrdinary &&
          !lazyPublicIdByModule.has(target.canonical) &&
          partition.moduleCellIds[plan.moduleKey] !==
            partition.moduleCellIds[target.canonical]
        ) {
          throw new Error(
            `@marko/run: demand seal: loader in ${JSON.stringify(plan.moduleKey)} targets plan-universe module ${JSON.stringify(target.canonical)} outside both the lazy map and its eager cell`,
          );
        }
      }
    }
  }

  const passthroughIdByCanonical = new Map<string, string>();
  const passthroughRequesterByCanonical = new Map<string, string>();
  for (const plan of plans) {
    for (const request of plan.requestedModules) {
      if (
        request.form !== "dynamic-import" ||
        plansByModule.has(request.canonical) ||
        !ordinaryVirtualSources.has(request.canonical)
      ) {
        continue;
      }
      passthroughIdByCanonical.set(
        request.canonical,
        ORDINARY_VIRTUAL_PREFIX + `o_${hash(request.canonical)}`,
      );
      passthroughRequesterByCanonical.set(request.canonical, plan.moduleKey);
    }
    for (const statement of plan.statements) {
      const recordedSpans = new Set(
        plan.requestedModules
          .filter(
            (request) =>
              request.form === "dynamic-import" &&
              request.ordinal === statement.ordinal,
          )
          .map((request) => `${request.span.start}:${request.span.end}`),
      );
      for (const residual of dynamicImportLiterals(statement.text)) {
        if (recordedSpans.has(`${residual.start}:${residual.end}`)) continue;
        const canonical = resolveRegisteredOrdinary(
          plan,
          residual.raw,
          ordinaryVirtualSources,
        );
        if (!canonical) {
          throw new Error(
            `@marko/run: residual dynamic import in ${JSON.stringify(plan.moduleKey)} at ordinal ${statement.ordinal} has no registered canonical for ${JSON.stringify(residual.raw)}`,
          );
        }
        passthroughIdByCanonical.set(
          canonical,
          ORDINARY_VIRTUAL_PREFIX + `o_${hash(canonical)}`,
        );
        passthroughRequesterByCanonical.set(canonical, plan.moduleKey);
      }
    }
  }
  const passthroughs = [...passthroughIdByCanonical]
    .sort(([a], [b]) => compareString(a, b))
    .map(([canonical, virtualId]): EmittedOrdinaryPassthrough => {
      const requestingModule = passthroughRequesterByCanonical.get(canonical)!;
      const source = ordinaryVirtualSources.get(canonical);
      return {
        canonical,
        virtualId,
        requestingModule,
        ...(source !== undefined ? { source } : null),
      };
    });
  const passthroughCanonicalById = new Map<string, string>();
  for (const passthrough of passthroughs) {
    const collision = passthroughCanonicalById.get(passthrough.virtualId);
    if (collision && collision !== passthrough.canonical) {
      throw new Error(
        `@marko/run: ordinary passthrough id collision: ${JSON.stringify(collision)} and ${JSON.stringify(passthrough.canonical)}`,
      );
    }
    passthroughCanonicalById.set(passthrough.virtualId, passthrough.canonical);
  }

  const artifacts = units.map((unit): EmittedArtifact => {
    const publicId = unit.publicId!;
    const emitted = emitCell({
      rootModuleKeys: unit.rootModuleKeys,
      moduleKeys: unit.moduleKeys,
      plansByModule,
      publicIdByModule,
      lazyPublicIdByModule,
      passthroughIdByCanonical,
      ordinaryVirtualSources,
      namespaceExportModuleKeys: unit.facadeModuleKeys,
    });
    if (emitted.source.includes("?persisted")) {
      const context = emitted.source
        .split("\n")
        .find((line) => line.includes("?persisted"));
      throw new Error(
        `@marko/run: artifact ${publicId} retained a forbidden ?persisted reference: ${context}`,
      );
    }
    return {
      publicId,
      virtualId: ARTIFACT_VIRTUAL_PREFIX + publicId,
      cellId: unit.cell.cellId,
      rootModuleKey: unit.rootModuleKey,
      moduleKeys: unit.moduleKeys,
      capabilityShellIds: unit.capabilityShellIds,
      source: emitted.source,
      manifest: emitted.manifest,
    };
  });
  const facadeExportsByModule = new Map<
    string,
    [exported: string, internal: string][]
  >();
  for (const unit of units) {
    if (!unit.facadeModuleKeys.length) continue;
    const emitted = emitCell({
      rootModuleKeys: unit.rootModuleKeys,
      moduleKeys: unit.moduleKeys,
      plansByModule,
      publicIdByModule,
      lazyPublicIdByModule,
      passthroughIdByCanonical,
      ordinaryVirtualSources,
      namespaceExportModuleKeys: unit.facadeModuleKeys,
    });
    for (const [moduleKey, exports] of emitted.namespaceExports) {
      facadeExportsByModule.set(moduleKey, exports);
    }
  }
  const facades = facadeSpecs.map((facade): EmittedArtifactFacade => {
    const exports = facadeExportsByModule.get(facade.moduleKey) ?? [];
    return {
      ...facade,
      virtualId: ARTIFACT_VIRTUAL_PREFIX + facade.publicId,
      source:
        exports.length > 0
          ? `export { ${exports
              .map(([exported, internal]) =>
                internal === exported ? internal : `${internal} as ${exported}`,
              )
              .join(", ")} } from ${JSON.stringify(
              ARTIFACT_VIRTUAL_PREFIX + facade.artifactPublicId,
            )};\n`
          : `import ${JSON.stringify(
              ARTIFACT_VIRTUAL_PREFIX + facade.artifactPublicId,
            )};\n`,
    };
  });
  const artifactIndexByPublicId = new Map(
    artifacts.map((artifact, index) => [artifact.publicId, index]),
  );

  const shellIds = [
    ...new Set(artifacts.flatMap((artifact) => artifact.capabilityShellIds)),
  ].sort(compareString);
  const shellIndex = new Map(
    shellIds.map((shellId, index) => [shellId, index]),
  );
  const capability: ArtifactCapability = {
    shellIds,
    artifacts: artifacts.flatMap((artifact, artifactIndex) => {
      if (!artifact.capabilityShellIds.length) return [];
      return [
        [
          artifactIndex,
          ...artifact.capabilityShellIds.map(
            (shellId) => shellIndex.get(shellId)!,
          ),
        ],
      ];
    }),
  };

  const eagerRootByRoute = new Map<number, string>();
  for (const root of partition.roots) {
    if (root.kind !== "eager-route") continue;
    for (const routeIndex of root.routeIndexes ?? []) {
      if (eagerRootByRoute.has(routeIndex)) {
        throw new Error(
          `@marko/run: route ${routeIndex} has multiple eager roots`,
        );
      }
      eagerRootByRoute.set(routeIndex, root.moduleKey);
    }
  }
  const routes = Object.entries(partition.routeProjections)
    .map(([routeIndexText, projection]): ArtifactRoute => {
      const routeIndex = Number(routeIndexText);
      const eagerArtifactIds = projection.eagerCellIds.flatMap((cellId) => {
        const publicIds = publicIdsByCell.get(cellId);
        if (!publicIds) {
          throw new Error(
            `@marko/run: route ${routeIndex} references unreachable cell ${JSON.stringify(cellId)}`,
          );
        }
        return publicIds;
      });
      const rootModuleKey = eagerRootByRoute.get(routeIndex);
      const primaryId = rootModuleKey && publicIdByModule.get(rootModuleKey);
      if (!primaryId || !eagerArtifactIds.includes(primaryId)) {
        throw new Error(
          `@marko/run: route ${routeIndex} has no emitted primary artifact`,
        );
      }
      return {
        routeIndex,
        primaryArtifactIndex: artifactIndexByPublicId.get(primaryId)!,
        primaryRegistryIndex: -1,
        eagerArtifactIndexes: eagerArtifactIds.map(
          (publicId) => artifactIndexByPublicId.get(publicId)!,
        ),
        eagerArtifactIds,
        possessionShellIndexes: projection.possessionShellIds
          .map((shellId) => shellIndex.get(shellId))
          .filter((index): index is number => index !== undefined),
      };
    })
    .sort((a, b) => a.routeIndex - b.routeIndex);

  const lazyArtifactIds = new Set(
    [...lazyPublicIdByModule.values()].map(
      (publicId) =>
        facadeSpecs.find((facade) => facade.publicId === publicId)
          ?.artifactPublicId ?? publicId,
    ),
  );
  const registry = [
    ...new Set(
      routes.map((route) => artifacts[route.primaryArtifactIndex].virtualId),
    ),
  ];
  const registryIndex = new Map(
    registry.map((virtualId, index) => [virtualId, index]),
  );
  for (const route of routes) {
    route.primaryRegistryIndex = registryIndex.get(
      artifacts[route.primaryArtifactIndex].virtualId,
    )!;
  }
  const aliases = registry.map(
    (targetVirtualId, index): EmittedArtifactAlias => ({
      virtualId: ARTIFACT_IMPORT_PREFIX + index.toString(36),
      targetVirtualId: targetVirtualId!,
    }),
  );
  const mergeVirtualByModuleKey: Record<string, string> = {};
  for (const [moduleKey, publicId] of publicIdByModule) {
    // Prefer facade virtual when a private module has its own public id.
    const facade = facades.find((entry) => entry.publicId === publicId);
    mergeVirtualByModuleKey[moduleKey] = facade
      ? facade.virtualId
      : ARTIFACT_VIRTUAL_PREFIX + publicId;
  }

  return {
    contentFingerprint: partition.inputFingerprint,
    artifacts,
    facades,
    lazyArtifacts: artifacts.filter((artifact) =>
      lazyArtifactIds.has(artifact.publicId),
    ),
    aliases,
    passthroughs,
    registry: aliases.map((alias) => alias.virtualId),
    capability,
    routes,
    mergeVirtualByModuleKey,
  };
}

interface EmitCellOptions {
  rootModuleKeys: readonly string[];
  moduleKeys: readonly string[];
  plansByModule: ReadonlyMap<string, FinalizedPlan>;
  publicIdByModule: ReadonlyMap<string, string>;
  lazyPublicIdByModule: ReadonlyMap<string, string>;
  passthroughIdByCanonical: ReadonlyMap<string, string>;
  ordinaryVirtualSources: ReadonlyMap<string, string | undefined>;
  namespaceExportModuleKeys?: readonly string[];
}

interface ExternalUse {
  canonical: string;
  raw: string;
  attributes: RequestAttr[];
  order: number;
  firstModule: string;
  firstOrdinal: number;
  afterBody: boolean;
  commentsBefore: string[];
  commentsAfter: string[];
  bare: boolean;
  plainResidueOnly: boolean;
  names: Map<string, string>;
  namespace?: string;
}

function emitCell(opts: EmitCellOptions): {
  source: string;
  manifest: ArtifactManifest;
  namespaceExports: Map<string, [exported: string, internal: string][]>;
} {
  const {
    rootModuleKeys,
    moduleKeys,
    plansByModule,
    publicIdByModule,
    lazyPublicIdByModule,
    passthroughIdByCanonical,
    ordinaryVirtualSources,
    namespaceExportModuleKeys = [],
  } = opts;
  const namespaceExports = new Set(namespaceExportModuleKeys);
  const membership = new Set(moduleKeys);
  const rootModuleKey = rootModuleKeys[0];
  const root = plansByModule.get(rootModuleKey);
  if (!root || !membership.has(rootModuleKey)) {
    throw new Error(`@marko/run: emit has no root plan for ${rootModuleKey}`);
  }
  const rootPlans = rootModuleKeys.map((moduleKey) => {
    const plan = plansByModule.get(moduleKey);
    if (!plan || !membership.has(moduleKey)) {
      throw new Error(`@marko/run: emit has no root plan for ${moduleKey}`);
    }
    return plan;
  });
  const directRootPlans = rootPlans.filter(
    (plan) => !namespaceExports.has(plan.moduleKey),
  );
  if (directRootPlans.length) {
    const publicExports = new Set<string>();
    for (const plan of directRootPlans) {
      for (const record of plan.exports) {
        if (publicExports.has(record.exported)) {
          throw new Error(
            `@marko/run: emit roots have duplicate public export ${JSON.stringify(record.exported)} in ${JSON.stringify(plan.moduleKey)}`,
          );
        }
        publicExports.add(record.exported);
      }
    }
  }

  const externals = new Map<string, ExternalUse>();
  const schedule: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const cycles: string[][] = [];
  const stack: string[] = [];
  let bodySeen = false;
  const noteExternal = (
    plan: FinalizedPlan,
    request: FinalizedPlan["requestedModules"][number],
  ) => {
    const identity = requestIdentity(request.canonical, request.attributes);
    let use = externals.get(identity);
    if (!use) {
      externals.set(
        identity,
        (use = {
          canonical: request.canonical,
          raw: request.specifier,
          attributes: request.attributes,
          order: externals.size,
          firstModule: plan.moduleKey,
          firstOrdinal: request.ordinal,
          afterBody: bodySeen,
          commentsBefore: [],
          commentsAfter: [],
          bare: false,
          plainResidueOnly: request.plainTemplate,
          names: new Map(),
        }),
      );
    }
    const comments = plan.statements[request.ordinal]?.comments;
    if (comments) {
      use.commentsBefore.push(...comments.leading);
      use.commentsAfter.push(...comments.internal, ...comments.trailing);
    }
    if (request.bare) use.bare = true;
    if (!request.plainTemplate) use.plainResidueOnly = false;
  };
  const visit = (moduleKey: string) => {
    const prior = state.get(moduleKey);
    if (prior === "done") return;
    if (prior === "visiting") {
      cycles.push([...stack.slice(stack.indexOf(moduleKey)), moduleKey]);
      return;
    }
    const plan = plansByModule.get(moduleKey);
    if (!plan || !membership.has(moduleKey)) {
      throw new Error(`@marko/run: emit missing cell member ${moduleKey}`);
    }
    state.set(moduleKey, "visiting");
    stack.push(moduleKey);
    for (const request of plan.requestedModules) {
      if (request.form === "dynamic-import") continue;
      if (
        membership.has(request.canonical) &&
        (request.kind === "internalized-child" ||
          request.kind === "load-edge-child")
      ) {
        visit(request.canonical);
      } else {
        noteExternal(plan, request);
      }
    }
    stack.pop();
    state.set(moduleKey, "done");
    schedule.push(moduleKey);
    bodySeen = true;
  };
  for (const moduleKey of rootModuleKeys) {
    // Disconnected roots have no request-event ordering relation. Each must
    // independently satisfy External-Prefix; their retained imports are then
    // emitted in one module prefix before the merged bodies.
    bodySeen = false;
    visit(moduleKey);
  }
  const missed = moduleKeys.filter((moduleKey) => !state.has(moduleKey));
  if (missed.length) {
    throw new Error(
      `@marko/run: cell rooted at ${JSON.stringify(rootModuleKey)} has disconnected members: ${missed.join(", ")}`,
    );
  }

  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let result = key;
    while (parent.get(result) && parent.get(result) !== result) {
      result = parent.get(result)!;
    }
    parent.set(key, result);
    return result;
  };
  const union = (a: string, b: string) => {
    const aRoot = find(a);
    const bRoot = find(b);
    if (aRoot !== bRoot) parent.set(aRoot, bRoot);
  };
  const symKey = (moduleKey: string, symId: string) => `${moduleKey}\0${symId}`;
  const extKey = (identity: string, imported: string) =>
    `ext\0${identity}\0${imported}`;
  const defaultExprSym = (ordinal: number) => `%default@${ordinal}`;
  const extUses = new Map<string, { identity: string; imported: string }>();
  const useExt = (identity: string, imported: string) => {
    const key = extKey(identity, imported);
    extUses.set(key, { identity, imported });
    return key;
  };
  const exportTargetKey = (
    childKey: string,
    imported: string,
    seen: string[] = [],
  ): string => {
    const hop = `${childKey}\0${imported}`;
    if (seen.includes(hop)) {
      throw new EmitRejection(
        "circular-reexport",
        childKey,
        -1,
        childKey,
        `re-export resolution cycle: ${[...seen, hop].join(" -> ")}`,
      );
    }
    const child = plansByModule.get(childKey);
    const record = child?.exports.find(
      (candidate) => candidate.exported === imported,
    );
    if (!record) {
      throw new Error(
        `@marko/run: emit: ${childKey} exports no ${JSON.stringify(imported)}`,
      );
    }
    switch (record.target.kind) {
      case "local":
        return symKey(childKey, record.target.symId);
      case "external":
        return membership.has(record.target.canonical)
          ? exportTargetKey(record.target.canonical, record.target.imported, [
              ...seen,
              hop,
            ])
          : useExt(
              requestIdentity(
                record.target.canonical,
                record.target.attributes,
              ),
              record.target.imported,
            );
      case "default-expr":
        return symKey(childKey, defaultExprSym(record.target.ordinal));
    }
  };

  for (const moduleKey of schedule) {
    const plan = plansByModule.get(moduleKey)!;
    for (const [symId, symbol] of Object.entries(plan.symbols)) {
      if (symbol.kind !== "import") continue;
      const target = symbol.import!;
      if (membership.has(target.canonical)) {
        if (target.imported === "*") {
          throw new Error(
            `@marko/run: emit: namespace import of internalized ${target.canonical} is unsupported`,
          );
        }
        union(
          symKey(moduleKey, symId),
          exportTargetKey(target.canonical, target.imported),
        );
      } else {
        union(
          symKey(moduleKey, symId),
          extKey(
            requestIdentity(target.canonical, target.attributes),
            target.imported,
          ),
        );
      }
    }
  }

  const classes = new Map<string, { name?: string }>();
  const taken = new Set<string>();
  const allocationOrder = [
    ...rootModuleKeys,
    ...schedule.filter((moduleKey) => !rootModuleKeys.includes(moduleKey)),
  ];
  for (const moduleKey of allocationOrder) {
    const plan = plansByModule.get(moduleKey)!;
    const symbols: [string, string][] = [
      ...Object.entries(plan.symbols).map(
        ([symId, symbol]) => [symId, symbol.name] as [string, string],
      ),
      ...plan.exports
        .filter((record) => record.target.kind === "default-expr")
        .map(
          (record) =>
            [
              defaultExprSym((record.target as { ordinal: number }).ordinal),
              "$default",
            ] as [string, string],
        ),
    ];
    for (const [symId, base] of symbols) {
      const classKey = find(symKey(moduleKey, symId));
      let info = classes.get(classKey);
      if (!info) classes.set(classKey, (info = {}));
      if (info.name) continue;
      let name = base;
      let suffix = 2;
      while (taken.has(name)) name = `${base}_${suffix++}`;
      info.name = name;
      taken.add(name);
    }
  }
  const nameOf = (moduleKey: string, symId: string) => {
    const name = classes.get(find(symKey(moduleKey, symId)))?.name;
    if (!name) {
      throw new Error(
        `@marko/run: emit: unallocated symbol ${moduleKey} ${symId}`,
      );
    }
    return name;
  };

  const droppedResidue: string[] = [];
  for (const moduleKey of schedule) {
    const plan = plansByModule.get(moduleKey)!;
    for (const [symId, symbol] of Object.entries(plan.symbols)) {
      if (symbol.kind !== "import") continue;
      const target = symbol.import!;
      if (membership.has(target.canonical)) continue;
      const identity = requestIdentity(target.canonical, target.attributes);
      const use = externals.get(identity);
      if (!use) continue;
      if (
        use.plainResidueOnly &&
        symbol.refCount === 0 &&
        !publicIdByModule.has(target.canonical)
      ) {
        droppedResidue.push(
          `${moduleKey}: unreferenced plain import ${symbol.name}`,
        );
        continue;
      }
      use.plainResidueOnly = false;
      if (target.imported === "*") use.namespace = nameOf(moduleKey, symId);
      else use.names.set(target.imported, nameOf(moduleKey, symId));
    }
  }
  for (const { identity, imported } of extUses.values()) {
    const name = classes.get(find(extKey(identity, imported)))?.name;
    const use = externals.get(identity);
    if (!name || !use) continue;
    use.plainResidueOnly = false;
    if (imported === "*") use.namespace ??= name;
    else use.names.set(imported, name);
  }
  const publicPlans = [
    ...directRootPlans,
    ...namespaceExportModuleKeys
      .filter(
        (moduleKey) =>
          !directRootPlans.some((plan) => plan.moduleKey === moduleKey),
      )
      .map((moduleKey) => plansByModule.get(moduleKey)!),
  ];
  for (const publicPlan of publicPlans) {
    for (const record of publicPlan.exports) {
      if (
        record.target.kind === "external" &&
        !membership.has(record.target.canonical)
      ) {
        const use = externals.get(
          requestIdentity(record.target.canonical, record.target.attributes),
        );
        if (use) use.plainResidueOnly = false;
      }
    }
  }

  const retained = [...externals.values()].filter((use) => {
    if (
      use.plainResidueOnly &&
      !use.bare &&
      !use.names.size &&
      !use.namespace
    ) {
      droppedResidue.push(`dropped ${use.canonical}`);
      return false;
    }
    return true;
  });
  for (const use of retained) {
    if (use.afterBody) {
      throw new EmitRejection(
        "late-external-after-body",
        use.firstModule,
        use.firstOrdinal,
        use.canonical,
        "retained external first requested after an internalized body event",
      );
    }
  }
  retained.sort((a, b) => a.order - b.order);

  const emittedSpecifier = (canonical: string, raw: string) => {
    const publicId = publicIdByModule.get(canonical);
    if (publicId) return ARTIFACT_VIRTUAL_PREFIX + publicId;
    // Artifact modules live under a virtual id, so a relative spelling no
    // longer has the original plan's importer as its resolution base. Keep
    // package/builtin spellings public, but attach file-like requests by the
    // resolver-issued canonical identity the finalized plan consumed.
    return raw.startsWith(".") || raw.startsWith("/") ? canonical : raw;
  };
  const attributesText = (attributes: RequestAttr[]) =>
    attributes.length
      ? ` with { ${attributes
          .map(
            ({ key, value, quoted }) =>
              `${quoted ? JSON.stringify(key) : key}: ${JSON.stringify(value)}`,
          )
          .join(", ")} }`
      : "";
  const out: string[] = [];
  const imports: ArtifactManifest["imports"] = [];
  for (const use of retained) {
    const emitted = emittedSpecifier(use.canonical, use.raw);
    const attributes = attributesText(use.attributes);
    const named: string[] = [];
    const names: { imported: string; local: string }[] = [];
    let defaultLocal: string | undefined;
    for (const [imported, local] of use.names) {
      names.push({ imported, local });
      if (imported === "default") defaultLocal = local;
      else
        named.push(imported === local ? imported : `${imported} as ${local}`);
    }
    out.push(...use.commentsBefore);
    if (use.namespace) {
      out.push(
        `import * as ${use.namespace} from ${JSON.stringify(emitted)}${attributes};`,
      );
    }
    if (defaultLocal || named.length) {
      const parts = [
        ...(defaultLocal ? [defaultLocal] : []),
        ...(named.length ? [`{ ${named.join(", ")} }`] : []),
      ];
      out.push(
        `import ${parts.join(", ")} from ${JSON.stringify(emitted)}${attributes};`,
      );
    } else if (!use.namespace) {
      // Bare side-effect import. Artifact virtuals retain effects via the
      // resolve hook's moduleSideEffects: true (plugin), not by shaping bytes.
      out.push(`import ${JSON.stringify(emitted)}${attributes};`);
    }
    out.push(...use.commentsAfter);
    imports.push({
      canonical: use.canonical,
      emitted,
      names,
      ...(use.namespace ? { namespace: use.namespace } : null),
      bare: use.bare,
    });
  }

  for (const moduleKey of schedule) {
    const plan = plansByModule.get(moduleKey)!;
    const isRoot =
      rootModuleKeys.includes(moduleKey) && !namespaceExports.has(moduleKey);
    for (const statement of plan.statements) {
      if (
        statement.kind === "import" ||
        statement.kind === "reexport" ||
        statement.kind === "export-locals"
      ) {
        continue;
      }
      const edits: { start: number; end: number; text: string }[] = [];
      for (const [start, end, symId] of statement.spans) {
        const finalName = nameOf(moduleKey, symId);
        const symbol = plan.symbols[symId];
        if (symbol && finalName !== symbol.name) {
          edits.push({ start, end, text: finalName });
        }
      }
      for (const request of plan.requestedModules) {
        if (
          request.ordinal !== statement.ordinal ||
          request.form !== "dynamic-import"
        ) {
          continue;
        }
        const publicId = lazyPublicIdByModule.get(request.canonical);
        // Ready registration via setup virtual must load BOTH DOM and merge
        // (dual's thin ready module does). Remap import("setup") to
        // Promise.all([DOM, merge]). Miss or malformed call = hard fail.
        if (publicId && request.canonical.includes(".marko-virtual.setup.js")) {
          const base = request.canonical.replace(
            /\.marko-virtual\.setup\.js$/,
            "",
          );
          const mergeId =
            publicIdByModule.get(`${base}.persisted-entry.marko`) ||
            publicIdByModule.get(`${base}.marko?persisted`);
          if (!mergeId) {
            throw new Error(
              `@marko/run: ready setup ${JSON.stringify(request.canonical)} has no merge artifact (module ${JSON.stringify(plan.moduleKey)})`,
            );
          }
          const mergeVirtual = ARTIFACT_VIRTUAL_PREFIX + mergeId;
          const domPath = `${base}.marko`;
          const importCallStart = request.span.start - "import(".length;
          const prefix = statement.text.slice(
            importCallStart,
            request.span.start,
          );
          const close = statement.text[request.span.end];
          if (prefix !== "import(" || close !== ")") {
            throw new Error(
              `@marko/run: ready setup import shape is not import("…") in ${JSON.stringify(plan.moduleKey)} (prefix=${JSON.stringify(prefix)} close=${JSON.stringify(close)})`,
            );
          }
          edits.push({
            start: importCallStart,
            end: request.span.end + 1,
            text: `Promise.all([import(${JSON.stringify(
              domPath,
            )}),import(${JSON.stringify(mergeVirtual)})])`,
          });
          continue;
        }
        if (!publicId) {
          const passthroughId = passthroughIdByCanonical.get(request.canonical);
          if (passthroughId) {
            edits.push({
              start: request.span.start,
              end: request.span.end,
              text: JSON.stringify(passthroughId),
            });
            continue;
          }
          // A template-loader fetches the ordinary render half and is not a
          // persisted artifact boundary. Persisted/update demand targets,
          // however, must be sealed into exactly one lazy cell.
          if (request.specifier.includes("?persisted")) {
            throw new Error(
              `@marko/run: demand target ${JSON.stringify(request.canonical)} has no lazy artifact`,
            );
          }
          const isRealFile =
            request.canonical.startsWith("/") ||
            /^[A-Za-z]:[/\\]/.test(request.canonical);
          if (!isRealFile || request.canonical.includes(".marko-virtual.")) {
            throw new Error(
              `@marko/run: residual dynamic import in ${JSON.stringify(plan.moduleKey)} at ordinal ${request.ordinal} targets unregistered canonical ${JSON.stringify(request.canonical)}`,
            );
          }
          const emitted = emittedSpecifier(
            request.canonical,
            request.specifier,
          );
          if (emitted !== request.specifier) {
            edits.push({
              start: request.span.start,
              end: request.span.end,
              text: JSON.stringify(emitted),
            });
          }
          continue;
        }
        edits.push({
          start: request.span.start,
          end: request.span.end,
          text: JSON.stringify(ARTIFACT_VIRTUAL_PREFIX + publicId),
        });
      }
      const recordedSpans = new Set(
        plan.requestedModules
          .filter(
            (request) =>
              request.form === "dynamic-import" &&
              request.ordinal === statement.ordinal,
          )
          .map((request) => `${request.span.start}:${request.span.end}`),
      );
      for (const residual of dynamicImportLiterals(statement.text)) {
        if (recordedSpans.has(`${residual.start}:${residual.end}`)) continue;
        const canonical = resolveRegisteredOrdinary(
          plan,
          residual.raw,
          ordinaryVirtualSources,
        );
        const passthroughId =
          canonical && passthroughIdByCanonical.get(canonical);
        if (!canonical || !passthroughId) {
          throw new Error(
            `@marko/run: residual dynamic import in ${JSON.stringify(plan.moduleKey)} at ordinal ${statement.ordinal} has no registered passthrough canonical for ${JSON.stringify(residual.raw)}`,
          );
        }
        edits.push({
          start: residual.start,
          end: residual.end,
          text: JSON.stringify(passthroughId),
        });
      }
      if (!isRoot) {
        if (statement.kind === "export-decl") {
          edits.push({
            start: statement.nodeOffset,
            // Remove only the keyword. Comments between `export` and the
            // declaration live verbatim in the canonical statement text.
            end: statement.nodeOffset + "export".length,
            text: "",
          });
        } else if (statement.kind === "export-default") {
          const record = plan.exports.find(
            (candidate) =>
              candidate.exported === "default" &&
              (candidate.target.kind !== "default-expr" ||
                candidate.target.ordinal === statement.ordinal),
          );
          const prefix = statement.text.slice(
            statement.nodeOffset,
            statement.innerOffset,
          );
          const exportDefault = /^export\s+default\b/.exec(prefix);
          if (!exportDefault) {
            throw new Error(
              `@marko/run: emit: malformed export-default prefix in ${moduleKey}@${statement.ordinal}`,
            );
          }
          edits.push({
            start: statement.nodeOffset,
            // Keep post-keyword trivia, notably Marko's tree-shaking
            // `/*@__PURE__*/` annotations, attached to the expression.
            end: statement.nodeOffset + exportDefault[0].length,
            text:
              record?.target.kind === "default-expr"
                ? `const ${nameOf(moduleKey, defaultExprSym(statement.ordinal))} = `
                : "",
          });
        }
      }
      edits.sort((a, b) => a.start - b.start);
      let at = 0;
      let text = "";
      for (const edit of edits) {
        if (edit.start < at || edit.end < edit.start) {
          throw new Error(
            `@marko/run: emit: overlapping statement edits in ${moduleKey}@${statement.ordinal}`,
          );
        }
        text += statement.text.slice(at, edit.start) + edit.text;
        at = edit.end;
      }
      text += statement.text.slice(at);
      const trimmed = text.replace(/\s+$/, "");
      if (trimmed) out.push(trimmed);
    }
  }

  const declarationExports = new Set(
    directRootPlans.flatMap((rootPlan) =>
      rootPlan.statements
        .filter(
          (statement) =>
            statement.kind === "export-decl" ||
            statement.kind === "export-default",
        )
        .flatMap((statement) =>
          rootPlan.exports
            .filter(
              (record) =>
                (record.target.kind === "local" &&
                  rootPlan.symbols[record.target.symId]?.declOrdinal ===
                    statement.ordinal) ||
                (record.target.kind === "default-expr" &&
                  record.target.ordinal === statement.ordinal),
            )
            .map((record) => `${rootPlan.moduleKey}\0${record.exported}`),
        ),
    ),
  );
  const exportLocal = (finalName: string, exported: string) => {
    out.push(
      `export { ${finalName === exported ? finalName : `${finalName} as ${exported}`} };`,
    );
  };
  const exportRecords = publicPlans.flatMap((publicPlan) =>
    publicPlan.exports
      .filter(
        (record) =>
          !declarationExports.has(
            `${publicPlan.moduleKey}\0${record.exported}`,
          ),
      )
      .map((record) => ({ publicPlan, record })),
  );
  const facadeExports = new Map<
    string,
    [exported: string, internal: string][]
  >();
  const emittedComments = new Set<string>();
  exportRecords.forEach(({ publicPlan, record }, index) => {
    const internalExport = namespaceExports.has(publicPlan.moduleKey)
      ? `__c2_${moduleKeys.indexOf(publicPlan.moduleKey).toString(36)}_${publicPlan.exports.indexOf(record).toString(36)}`
      : record.exported;
    if (namespaceExports.has(publicPlan.moduleKey)) {
      const exports = facadeExports.get(publicPlan.moduleKey);
      const pair: [string, string] = [record.exported, internalExport];
      if (exports) exports.push(pair);
      else facadeExports.set(publicPlan.moduleKey, [pair]);
    }
    const commentKey = `${publicPlan.moduleKey}\0${record.ordinal}`;
    const statement = publicPlan.statements[record.ordinal];
    const comments =
      statement &&
      (statement.kind === "export-locals" || statement.kind === "reexport")
        ? statement.comments
        : undefined;
    if (comments && !emittedComments.has(commentKey)) {
      emittedComments.add(commentKey);
      out.push(...comments.leading);
    }
    if (record.target.kind === "local") {
      exportLocal(
        nameOf(publicPlan.moduleKey, record.target.symId),
        internalExport,
      );
    } else if (record.target.kind === "external") {
      if (membership.has(record.target.canonical)) {
        const target = exportTargetKey(
          record.target.canonical,
          record.target.imported,
        );
        const finalName = classes.get(find(target))?.name;
        if (!finalName) {
          throw new Error(`@marko/run: emit: unallocated re-export ${target}`);
        }
        exportLocal(finalName, internalExport);
      } else {
        const emitted = emittedSpecifier(
          record.target.canonical,
          record.target.specifier,
        );
        out.push(
          `export { ${
            record.target.imported === internalExport
              ? internalExport
              : `${record.target.imported} as ${internalExport}`
          } } from ${JSON.stringify(emitted)}${attributesText(record.target.attributes)};`,
        );
      }
    } else {
      exportLocal(
        nameOf(publicPlan.moduleKey, defaultExprSym(record.target.ordinal)),
        internalExport,
      );
    }
    const next = exportRecords[index + 1];
    if (
      comments &&
      (next?.publicPlan.moduleKey !== publicPlan.moduleKey ||
        next.record.ordinal !== record.ordinal)
    ) {
      out.push(...comments.internal, ...comments.trailing);
    }
  });

  return {
    source: out.join("\n") + "\n",
    manifest: {
      rootModuleKey,
      schedule,
      cycles,
      imports,
      droppedResidue,
    },
    namespaceExports: facadeExports,
  };
}

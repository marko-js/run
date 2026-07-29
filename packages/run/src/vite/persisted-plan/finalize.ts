// The async FINALIZE stage (Rev 6.1 §1), productionized from the proven B0
// prototype (`persisted-pages-scratch/b0/twostage/finalize.ts`): substitute
// resolver-issued canonical ids throughout a preliminary plan, recompute
// firstOccurrence against canonical identity, cross-check the emission-site
// request classification through an INDEPENDENT classifier seam (allow-set
// membership only, never re-derivation), and record every resolver
// invalidation dep the finalization consumed as a full-OUTCOME
// `ResolutionDep`.
import crypto from "crypto";

import type {
  FinalizedExport,
  FinalizedLoader,
  FinalizedPlan,
  FinalizedRequest,
  FinalizedSymbol,
  ResolutionDep,
} from "./finalized-plan";
import { FINALIZED_PLAN_VERSION } from "./finalized-plan";
import type {
  PreliminaryPlan,
  PreliminaryRequest,
  RequestAttr,
  RequestKind,
} from "./preliminary-plan";
import {
  assertLoadEdgeDemandCoverage,
  validatePreliminaryPlan,
} from "./preliminary-plan";

/** The `{ entry, virtuals }` carrier the frozen marko translator publishes
 * on `metadata.marko.updatePlan` (preliminary-plan@1.1). */
export interface PreliminaryUpdatePlans {
  entry: PreliminaryPlan;
  virtuals: Record<string, PreliminaryPlan>;
}

/** One resolution outcome. Production wraps the plugin container's
 * `this.resolve`; the B0 mock implements the same seam for unit tests. */
export interface Resolution {
  canonical: string;
  dep: ResolutionDep;
}

export interface PlanResolver {
  resolveId(
    specifier: string,
    importer: string,
    attributes?: RequestAttr[],
  ): Promise<Resolution>;
}

export function attrsKeyOf(attributes: RequestAttr[]): string {
  const pairs = attributes
    .map((a) => [a.key, a.value] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify(pairs);
}

/** The independent classifier seam: derives the ALLOW-SET of semantic
 * request kinds from the RESOLVED canonical identity + request shape, with
 * no access to the emission site's asserted kind. Finalization rejects when
 * the asserted kind is outside the set. For a bare static `?persisted`
 * import the allow-set is exactly {eager-candidate, load-edge-child} and
 * the seam re-derives NEITHER (compiler-semantic, @1.1 finding 1). */
export interface RequestClassifier {
  classify(args: {
    canonical: string;
    selfPlainCanonical: string | undefined;
    bare: boolean;
    form: PreliminaryRequest["form"];
  }): readonly RequestKind[];
}

export const defaultClassifier: RequestClassifier = {
  classify({ canonical, selfPlainCanonical, bare, form }) {
    if (form === "dynamic-import") return ["lazy-edge"];
    const base = canonical.split("#")[0];
    const qi = base.indexOf("?");
    const params = qi === -1 ? [] : base.slice(qi + 1).split("&");
    // The persisted flavor has two canonical spellings: the raw
    // `?persisted` query, and the fork `@marko/vite`'s internal
    // `.persisted-entry.marko` module id it rewrites that query into.
    if (
      params.includes("persisted") ||
      (qi === -1 ? base : base.slice(0, qi)).endsWith(".persisted-entry.marko")
    ) {
      return bare && form === "import"
        ? ["eager-candidate", "load-edge-child"]
        : ["internalized-child"];
    }
    if (selfPlainCanonical !== undefined && canonical === selfPlainCanonical) {
      return ["module-state"];
    }
    return ["external"];
  },
};

export class FinalizeError extends Error {
  constructor(importer: string, detail: string) {
    super(`finalize ${importer}: ${detail}`);
    this.name = "FinalizeError";
  }
}

function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return `{${keys
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** The finalized fingerprint: sha256 over the canonical JSON of the whole
 * finalized plan content INCLUDING resolutionDeps (a consumed resolver fact
 * whose outcome cannot change the substituted content — a virtual's content
 * hash — still changes the identity), EXCLUDING `resolverConfigTag`
 * (deps-only, never whole-config hashing — schema-review Q9). `includeDeps:
 * false` exists ONLY for the named control red proving the deps are
 * load-bearing. NOTE: `configEpoch` is cache-entry metadata and never enters
 * this body (brief §8.6 rider). */
export function fingerprintOf(
  plan: Omit<FinalizedPlan, "fingerprint">,
  includeDeps = true,
): string {
  const { resolverConfigTag: _tag, ...content } = plan;
  const body: Record<string, unknown> = { ...content };
  if (!includeDeps) delete body.resolutionDeps;
  return crypto.createHash("sha256").update(canonicalJson(body)).digest("hex");
}

export interface FinalizeOptions {
  resolver: PlanResolver;
  classifier?: RequestClassifier;
  /** Raw spelling of this module's own plain template when it has one (the
   * module-state target). */
  selfPlainRaw?: string;
  /** Context importer for resolving the module's OWN canonical id. */
  selfContext?: string;
  /** Informational tag for reports; NEVER part of the fingerprint. */
  resolverConfigTag?: string;
}

export async function finalizePlan(
  prelimIn: PreliminaryPlan,
  opts: FinalizeOptions,
): Promise<FinalizedPlan> {
  const prelim = validatePreliminaryPlan(prelimIn);
  const { resolver } = opts;
  const classifier = opts.classifier ?? defaultClassifier;
  const importer = prelim.importer;

  // Deduped resolution memo per (specifier, attrsKey): a plan requesting the
  // same raw identity many times consumes ONE resolver fact.
  const deps = new Map<string, ResolutionDep>();
  const resolve = async (
    specifier: string,
    attributes: RequestAttr[],
  ): Promise<string> => {
    const key = `${specifier}\0${attrsKeyOf(attributes)}`;
    const existing = deps.get(key);
    if (existing) return existing.canonical;
    const { canonical, dep } = await resolver.resolveId(
      specifier,
      importer,
      attributes,
    );
    deps.set(key, dep);
    return canonical;
  };

  const selfContext = opts.selfContext ?? "";
  const selfRes = await resolver.resolveId(importer, selfContext);
  const moduleKey = selfRes.canonical;
  const selfPlainCanonical =
    opts.selfPlainRaw !== undefined
      ? await resolve(opts.selfPlainRaw, [])
      : undefined;

  // --- Requests: substitute canonicals, seam-check kinds, recompute
  // firstOccurrence against canonical identity (static and dynamic streams
  // are separate identity spaces).
  const seenStatic = new Set<string>();
  const seenDynamic = new Set<string>();
  const requestedModules: FinalizedRequest[] = [];
  for (const ev of prelim.requestedModules) {
    const canonical = await resolve(ev.specifier, ev.attributes);
    const allowed = classifier.classify({
      canonical,
      selfPlainCanonical,
      bare: ev.bare,
      form: ev.form,
    });
    if (!allowed.includes(ev.kind)) {
      throw new FinalizeError(
        importer,
        `classifier seam mismatch at ordinal ${ev.ordinal}: emission site ` +
          `asserted "${ev.kind}" but canonical ${JSON.stringify(canonical)} ` +
          `allows {${allowed.join(", ")}}`,
      );
    }
    const identity = `${canonical}\0${attrsKeyOf(ev.attributes)}`;
    const stream = ev.form === "dynamic-import" ? seenDynamic : seenStatic;
    const firstOccurrence = !stream.has(identity);
    stream.add(identity);
    const { firstOccurrence: _prelim, ...rest } = ev;
    requestedModules.push({ ...rest, canonical, firstOccurrence });
  }

  // --- Symbols.
  const symbols: Record<string, FinalizedSymbol> = {};
  for (const [symId, sym] of Object.entries(prelim.symbols)) {
    if (sym.import) {
      symbols[symId] = {
        ...sym,
        import: {
          ...sym.import,
          canonical: await resolve(sym.import.specifier, sym.import.attributes),
        },
      };
    } else {
      const { import: _none, ...rest } = sym;
      symbols[symId] = rest;
    }
  }

  // --- Exports.
  const exports: FinalizedExport[] = [];
  for (const rec of prelim.exports) {
    if (rec.target.kind === "external") {
      exports.push({
        ...rec,
        target: {
          ...rec.target,
          canonical: await resolve(rec.target.specifier, rec.target.attributes),
        },
      });
    } else {
      exports.push(rec as FinalizedExport);
    }
  }

  // --- Loaders (lazy-edge targets resolve like any other request).
  const loaders: FinalizedLoader[] = [];
  for (const rec of prelim.loaders) {
    const targets = [];
    for (const specifier of rec.targets) {
      targets.push({ specifier, canonical: await resolve(specifier, []) });
    }
    loaders.push({ ...rec, targets });
  }

  // --- Links.
  const moduleStateLinks = [];
  for (const link of prelim.moduleStateLinks) {
    moduleStateLinks.push({
      ...link,
      canonical: await resolve(link.specifier, []),
    });
  }
  const eagerCandidates = [];
  for (const link of prelim.eagerCandidates) {
    eagerCandidates.push({
      ...link,
      canonical: await resolve(link.specifier, []),
    });
  }

  const resolutionDeps = [...deps.values()].sort((a, b) =>
    `${a.importer}\0${a.specifier}\0${a.attrsKey}` <
    `${b.importer}\0${b.specifier}\0${b.attrsKey}`
      ? -1
      : 1,
  );
  // The module's own resolution is a consumed fact too — recorded via the
  // resolver-returned dep so virtual self-identities keep their content hash.
  resolutionDeps.unshift(selfRes.dep);

  const body: Omit<FinalizedPlan, "fingerprint"> = {
    schemaVersion: FINALIZED_PLAN_VERSION,
    moduleKey,
    importer,
    originFile: prelim.originFile,
    fingerprintFields: prelim.fingerprintFields,
    statements: prelim.statements,
    symbols,
    requestedModules,
    exports,
    loaders,
    moduleStateLinks,
    eagerCandidates,
    shellCapability: prelim.shellCapability,
    shellPossession: prelim.shellPossession,
    resolutionDeps,
    resolverConfigTag: opts.resolverConfigTag ?? "",
  };
  return { ...body, fingerprint: fingerprintOf(body) };
}

/** A finalized `{ entry, virtuals }` carrier: one ATOMIC unit of work —
 * partial success publishes nothing. */
export interface FinalizedSet {
  entry: FinalizedPlan;
  virtuals: Record<string, FinalizedPlan>;
  /** All plans of the set, entry first (iteration convenience). */
  plans: FinalizedPlan[];
}

/** Finalizes the whole carrier atomically. Boundary validation runs the
 * UNTOUCHED @1.1 validator + the raw-stage set-level coverage first; the
 * post-finalize set-level check re-runs on CANONICAL ids (E3 — replacing
 * the raw posix-normalize prototype comparison). */
export async function finalizeSet(
  carrier: PreliminaryUpdatePlans,
  opts: FinalizeOptions,
): Promise<FinalizedSet> {
  // Intake sanity on the raw stage (prototype comparison, documented).
  const rawPlans = [carrier.entry, ...Object.values(carrier.virtuals)];
  for (const plan of rawPlans) validatePreliminaryPlan(plan);
  assertLoadEdgeDemandCoverage(rawPlans);

  const entry = await finalizePlan(carrier.entry, opts);
  const virtuals: Record<string, FinalizedPlan> = {};
  for (const [virtualId, plan] of Object.entries(carrier.virtuals)) {
    virtuals[virtualId] = await finalizePlan(plan, {
      ...opts,
      // The virtual's own identity resolves relative to its parent (the
      // compiler issued the id during the parent's compile).
      selfContext: carrier.entry.importer,
      selfPlainRaw: undefined,
    });
  }
  const plans = [entry, ...Object.values(virtuals)];
  assertCanonicalLoadEdgeCoverage(plans);
  return { entry, virtuals, plans };
}

/** E3: post-finalize set-level load-edge coverage on CANONICAL ids — every
 * plan carrying a load-edge-child request must itself be a canonical loader
 * target somewhere in the finalized set. */
export function assertCanonicalLoadEdgeCoverage(plans: FinalizedPlan[]) {
  const canonicalTargets = new Set<string>();
  for (const plan of plans) {
    for (const loader of plan.loaders) {
      for (const target of loader.targets) {
        canonicalTargets.add(target.canonical);
      }
    }
  }
  for (const plan of plans) {
    for (const ev of plan.requestedModules) {
      if (ev.kind !== "load-edge-child") continue;
      if (!canonicalTargets.has(plan.moduleKey)) {
        throw new FinalizeError(
          plan.importer,
          `canonical load-edge coverage: moduleKey ${JSON.stringify(
            plan.moduleKey,
          )} carries a load-edge-child request but is not a canonical ` +
            `loader target anywhere in the finalized set`,
        );
      }
    }
  }
}

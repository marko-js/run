// =============================================================================
// FINALIZED PLAN — the output of the async vite finalization stage
// (Rev 6.1 §1). FROZEN at the C1 partition boundary: the fields consumed by
// partition@1 are moduleKey, requestedModules, loaders/target canonicals,
// shellCapability, shellPossession, and fingerprint. preliminary-plan@1.1
// remains the frozen compiler-side interface.
//
// CHANGELOG
// finalized-plan@1 (2026-07-28, B0 prototype; productionized C0-R1)
//   Preliminary content + resolver-issued canonical ids substituted
//   throughout + resolution deps + fingerprint. Only FINALIZED plans are
//   fingerprinted, cached, or (later) partitioned/published; the cache is
//   private to the coordinator with resolver invalidation deps and is
//   never exposed via bundler module meta (Rev 6.1 §1).
// =============================================================================
import type {
  AttachedComments,
  EagerCandidateLink,
  LoaderTargetKind,
  ModuleStateLink,
  PreliminaryRequest,
  PreliminaryStatement,
  PreliminarySymbol,
  RequestAttr,
  ShellCapability,
  ShellPossessionFacts,
  SymId,
} from "./preliminary-plan";

export const FINALIZED_PLAN_VERSION = "finalized-plan@1";

/** One resolution fact the finalization CONSUMED. The dep records the full
 * OUTCOME of each (importer, specifier, attributes) resolution — not just
 * "which alias matched" — so cache validation re-resolves and catches
 * negative dependencies too (an alias ADDED later that would now shadow a
 * previously-plain resolution invalidates, because the recorded canonical no
 * longer matches; grok risk 5). */
export interface ResolutionDep {
  importer: string;
  specifier: string;
  /** Sorted-attrs identity component (attribute-carrying requests resolve
   * per-identity). */
  attrsKey: string;
  /** The canonical id the resolver issued when this plan finalized. */
  canonical: string;
  /** When `canonical` is a virtual module: content hash of the virtual at
   * finalization time. A virtual whose CONTENT changes keeps its canonical
   * id, so without this fact the mutation is invisible to the fingerprint —
   * the exact silent-wrong-artifact scenario (grok risk 5). */
  virtualContentHash?: string;
}

export interface FinalizedRequest extends Omit<
  PreliminaryRequest,
  "firstOccurrence"
> {
  /** Resolver-issued canonical id. */
  canonical: string;
  /** RECOMPUTED against canonical identity + attributes (two raw spellings
   * of one module collapse to one first occurrence; an alias split
   * diverges). Static forms only participate in the External-Prefix stream;
   * lazy-edge firstOccurrence is over the dynamic identity stream. */
  firstOccurrence: boolean;
}

export interface FinalizedSymbol extends Omit<PreliminarySymbol, "import"> {
  import?: PreliminarySymbol["import"] & { canonical: string };
}

export type FinalizedExportTarget =
  | { kind: "local"; symId: SymId }
  | {
      kind: "external";
      specifier: string;
      canonical: string;
      imported: string;
      attributes: RequestAttr[];
    }
  | { kind: "default-expr"; ordinal: number };

export interface FinalizedExport {
  exported: string;
  ordinal: number;
  target: FinalizedExportTarget;
}

export interface FinalizedLoader {
  targetKind: LoaderTargetKind;
  registryFn: string;
  rendererId: string;
  readyId?: string;
  /** Raw specifiers with their resolver-issued canonicals, index-aligned. */
  targets: { specifier: string; canonical: string }[];
  ordinal: number;
  firstWins: boolean;
  readyChain?: { readyId: string; failureLatch: boolean };
}

export interface FinalizedModuleStateLink extends ModuleStateLink {
  canonical: string;
}

export interface FinalizedEagerCandidateLink extends EagerCandidateLink {
  canonical: string;
}

export interface FinalizedPlan {
  schemaVersion: typeof FINALIZED_PLAN_VERSION;
  /** Resolver-issued canonical identity of THIS module. */
  moduleKey: string;
  /** The raw importer identity the preliminary plan carried. */
  importer: string;
  originFile: string;
  /** The preliminary compile-side Rev-4 field set (fingerprint INPUT). */
  fingerprintFields: Record<string, string | boolean>;
  statements: PreliminaryStatement[];
  symbols: Record<SymId, FinalizedSymbol>;
  requestedModules: FinalizedRequest[];
  exports: FinalizedExport[];
  loaders: FinalizedLoader[];
  moduleStateLinks: FinalizedModuleStateLink[];
  eagerCandidates: FinalizedEagerCandidateLink[];
  shellCapability: ShellCapability;
  shellPossession: ShellPossessionFacts;
  /** Every resolver fact this finalization consumed, deterministic order. */
  resolutionDeps: ResolutionDep[];
  /** Informational resolver-config tag (NOT part of the fingerprint: the
   * deps carry the consumed facts; hashing the whole config would
   * over-invalidate on unrelated config edits). */
  resolverConfigTag: string;
  /** sha256 over the canonical JSON of everything above. The plan's cache
   * and artifact identity. */
  fingerprint: string;
}

export type { AttachedComments };

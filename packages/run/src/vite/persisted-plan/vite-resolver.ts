// Adapts the raw resolve function the `@marko/vite` transform hands over
// (its `this.resolve` + virtual registry read) into the finalize stage's
// `PlanResolver` seam, recording every consumed resolution as a
// full-OUTCOME `ResolutionDep` (negative deps included by construction:
// the recorded canonical is the outcome, so a later alias that would now
// shadow it changes the outcome).
import crypto from "crypto";

import type { PersistedPlanHost } from "./coordinator";
import type {
  FinalizedSet,
  PlanResolver,
  PreliminaryUpdatePlans,
  Resolution,
} from "./finalize";
import { attrsKeyOf, FinalizeError } from "./finalize";
import type { ResolutionDep } from "./finalized-plan";
import type { RequestAttr } from "./preliminary-plan";

export interface RawViteResolve {
  resolve(specifier: string, importer: string): Promise<{ id: string } | null>;
  getVirtualContent(id: string): string | undefined;
}

export function contentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function createViteResolverAdapter(
  raw: RawViteResolve,
  noteVirtualSource?: (canonical: string, source: string | undefined) => void,
): PlanResolver {
  return {
    async resolveId(
      specifier: string,
      importer: string,
      attributes: RequestAttr[] = [],
    ): Promise<Resolution> {
      const resolved = await raw.resolve(specifier, importer);
      if (!resolved) {
        // An unresolvable plan request is an emission/graph bug, not a
        // runtime fallback: fail the build (brief §8.5).
        throw new FinalizeError(
          importer,
          `unresolvable plan request ${JSON.stringify(specifier)}`,
        );
      }
      const canonical = resolved.id;
      const virtualContent = raw.getVirtualContent(canonical);
      if (
        virtualContent !== undefined ||
        canonical.includes(".marko-virtual.")
      ) {
        noteVirtualSource?.(canonical, virtualContent);
      }
      const dep: ResolutionDep = {
        importer,
        specifier,
        attrsKey: attrsKeyOf(attributes),
        canonical,
        ...(virtualContent !== undefined
          ? { virtualContentHash: contentHash(virtualContent) }
          : null),
      };
      return { canonical, dep };
    },
  };
}

/** The intake shape the fork `@marko/vite` transform hands over. */
export interface MarkoViteIntake extends RawViteResolve {
  id: string;
  env: "ssr" | "client";
  carrier: unknown;
}

export interface MarkoViteHostCutover {
  /** dual-entry stubs side-effect-import this merge virtual. */
  resolveCutoverMerge?(sourceFile: string): string | undefined;
}

/** The structural host object registered on the `@marko/vite` options
 * (`persistedPlanHost`): adapts the fork's raw intake into the
 * coordinator's typed seam. Used by the run plugin AND the integration
 * gates so the two can never drift. */
export function createMarkoViteHost(
  host: PersistedPlanHost,
  cutover: MarkoViteHostCutover = {},
) {
  return {
    registerVirtualSource(canonical: string, source: string) {
      host.noteVirtualSource("ssr", canonical, source);
      host.noteVirtualSource("client", canonical, source);
    },
    ensureFinalized(intake: MarkoViteIntake): Promise<FinalizedSet | null> {
      const carrier = intake.carrier as PreliminaryUpdatePlans | undefined;
      return host.ensureFinalized({
        id: intake.id,
        env: intake.env,
        carrier,
        resolver: createViteResolverAdapter(intake, (canonical, source) =>
          host.noteVirtualSource(intake.env, canonical, source),
        ),
        // The module-state link carries the module's own plain template
        // spelling (site-asserted in the plan).
        selfPlainRaw: carrier?.entry.moduleStateLinks[0]?.specifier,
      });
    },
    onCompilerCacheWipe() {
      host.onCompilerCacheWipe();
    },
    resolveCutoverMerge(sourceFile: string) {
      return cutover.resolveCutoverMerge?.(sourceFile);
    },
  };
}

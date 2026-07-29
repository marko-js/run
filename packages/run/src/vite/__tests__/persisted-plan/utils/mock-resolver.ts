// The B0 mock vite resolver, ported unchanged in semantics
// (`persisted-pages-scratch/b0/twostage/resolver.ts`): async resolveId over
// aliases, queries, virtual ids, and attribute-carrying requests, returning
// the canonical id PLUS the invalidation facts consumed. TEST ground truth
// permanently — never a production fallback (c0-brief §5).
import crypto from "crypto";
import path from "path";

import type {
  PlanResolver,
  Resolution,
} from "../../../persisted-plan/finalize";
import { attrsKeyOf } from "../../../persisted-plan/finalize";
import type { ResolutionDep } from "../../../persisted-plan/finalized-plan";
import type { RequestAttr } from "../../../persisted-plan/preliminary-plan";

export interface MockResolverConfig {
  /** Human tag for reporting (never part of the fingerprint). */
  tag: string;
  /** Alias map: longest matching prefix wins. */
  alias: Record<string, string>;
  /** Virtual module registry: canonical id -> current content. */
  virtuals: Record<string, string>;
  /** Query rewrite rules: exact query string -> replacement. */
  queryRewrite: Record<string, string>;
  attrCanonicalKey?: string;
}

export function contentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export class MockViteResolver implements PlanResolver {
  config: MockResolverConfig;
  /** Counts real async resolutions (cost accounting for A2/B1). */
  resolveCount = 0;

  constructor(config: Partial<MockResolverConfig> = {}) {
    this.config = {
      tag: "mock",
      alias: {},
      virtuals: {},
      queryRewrite: {},
      ...config,
    };
  }

  async resolveId(
    specifier: string,
    importer: string,
    attributes: RequestAttr[] = [],
  ): Promise<Resolution> {
    this.resolveCount++;
    await Promise.resolve();

    let spec = specifier;
    let bestKey: string | undefined;
    for (const key of Object.keys(this.config.alias)) {
      if (spec.startsWith(key) && (!bestKey || key.length > bestKey.length)) {
        bestKey = key;
      }
    }
    if (bestKey !== undefined) {
      spec = this.config.alias[bestKey] + spec.slice(bestKey.length);
    }

    const q = spec.indexOf("?");
    let base = q === -1 ? spec : spec.slice(0, q);
    let query = q === -1 ? "" : spec.slice(q + 1);
    if (query && this.config.queryRewrite[query] !== undefined) {
      query = this.config.queryRewrite[query];
    }

    if (base.startsWith(".")) {
      const fromDir = path.posix.dirname(importer.split("?")[0]);
      base = path.posix.normalize(path.posix.join(fromDir, base));
    }

    let canonical = query ? `${base}?${query}` : base;

    if (this.config.attrCanonicalKey) {
      const hit = attributes.find(
        (a) => a.key === this.config.attrCanonicalKey,
      );
      if (hit) canonical += `#attr=${hit.value}`;
    }

    const virtualContent = this.config.virtuals[canonical];
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
  }
}

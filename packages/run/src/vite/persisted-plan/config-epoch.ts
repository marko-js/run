// THE config-epoch allowlist (brief §3 Rule 10): the resolver-relevant
// slice of configuration whose content hash gates the warm path. Every
// resolver-relevant input belongs HERE — an omission is an
// under-invalidation bug (silent wrong identity), an addition beyond the
// allowlist is over-invalidation (schema-review Q9 forbids whole-config
// hashing). This module is the single place the slice is assembled.
import crypto from "crypto";
import type { ResolvedConfig } from "vite";

export interface ConfigEpochSlice {
  /** vite `resolve.alias` entries (find/replacement pairs; regexp sources
   * stringified) — alias retarget/shadowing is invalidation class A3/A4. */
  alias: [find: string, replacement: string][];
  /** Resolution surface that changes canonical ids. */
  conditions: string[];
  extensions: string[];
  dedupe: string[];
  mainFields: string[];
  preserveSymlinks: boolean;
  /** Query/virtual behavior owned by the marko pipeline (class A6 query
   * rewrite rides plugin behavior; recorded here as the plugin NAMES whose
   * presence changes persisted-query handling — outcomes themselves are
   * deps, schema-Q9). */
  markoPluginNames: string[];
  /** Rev-4 fingerprint inputs that alter compile-side identity. */
  markoOptions: {
    runtimeId?: string;
    optimize?: boolean;
    translator?: string;
  };
  /** Registry hash for compiler-issued virtuals when the host tracks one. */
  virtualRegistryHash?: string;
  /** Persisted-query rewrite behavior (a resolver-relevant plugin fact).
   * Synthetic until @marko/vite exposes a configurable rewrite surface:
   * its current `?persisted` rewrite is fixed, so
   * configEpochSliceFromVite has no real option to populate here. */
  persistedQueryRewrite?: Record<string, string>;
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

export function computeConfigEpoch(slice: ConfigEpochSlice): string {
  return crypto
    .createHash("sha256")
    .update(canonicalJson(slice))
    .digest("hex")
    .slice(0, 16);
}

/** Assembles the allowlisted slice from a resolved vite config. Unrelated
 * config (server.port, logLevel, build.outDir…) NEVER enters the slice —
 * gate B2 pins that. */
export function configEpochSliceFromVite(
  config: Pick<ResolvedConfig, "resolve" | "plugins">,
  markoOptions: ConfigEpochSlice["markoOptions"] = {},
  virtualRegistryHash?: string,
): ConfigEpochSlice {
  const alias: [string, string][] = [];
  for (const entry of config.resolve.alias ?? []) {
    alias.push([String(entry.find), String(entry.replacement)]);
  }
  return {
    alias,
    conditions: [...(config.resolve.conditions ?? [])],
    extensions: [...(config.resolve.extensions ?? [])],
    dedupe: [...(config.resolve.dedupe ?? [])],
    mainFields: [...(config.resolve.mainFields ?? [])],
    preserveSymlinks: !!config.resolve.preserveSymlinks,
    markoPluginNames: config.plugins
      .map((plugin) => plugin.name)
      .filter((name) => /marko/.test(name))
      .sort(),
    markoOptions,
    ...(virtualRegistryHash !== undefined ? { virtualRegistryHash } : null),
  };
}

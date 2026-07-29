import { randomBytes } from "node:crypto";

import { claimSetIdLength } from "./persisted-protocol";

// Server-issued claim sets (E2): each successful patch response reserves a
// 128-bit CSPRNG id before rendering and binds it to the committed value
// store that response induces client-side. The next same-route request can
// then name the whole store with ~25 bytes instead of re-enumerating it.
// Purely an accelerator: an unknown id resolves to the request's hedged
// enumerated claims (base=e1) or nothing (base=empty) — a miss costs
// bytes, never correctness.

// In-process LRU claim-set store. Bounds: ~4096 entries keeps the worst
// case around 8 MB per instance. Fixed product constants (not env-tunable).
const CLAIM_SET_CAP = 4096;
const CLAIM_SET_TTL_MS = 30 * 60_000;
let testCap: number | undefined;
let testTtlMs: number | undefined;
function cap() {
  return testCap ?? CLAIM_SET_CAP;
}
function ttlMs() {
  return testTtlMs ?? CLAIM_SET_TTL_MS;
}

// Insertion-ordered like the instance-token memo: the first key is the
// least recently used because hits re-insert. `pending` holds atomic
// reservations (reserve inserts, bind consumes exactly once) so two
// in-flight renders can never share an id, and a bind whose reservation
// expired or was evicted is discarded rather than stored.
const claimSets = new Map<string, { store: string; expires: number }>();
const pending = new Map<string, number>();
const stats = { hit: 0, miss: 0, evict: 0 };

function claimSetKey(buildId: string, route: string, id: string) {
  return buildId + ";" + route + ";" + id;
}

let random: (bytes: number) => Buffer = randomBytes;

/** Reserves the next response's id before rendering: mints until the id
 * collides with neither a bound entry nor another pending reservation
 * (astronomical, or injected), then records the reservation — bounded
 * and TTL'd like the bound map. */
export function reserveClaimSetId(buildId: string, route: string): string {
  for (;;) {
    const id = random(16).toString("base64url");
    const key = claimSetKey(buildId, route, id);
    if (
      id.length === claimSetIdLength &&
      !claimSets.has(key) &&
      !pending.has(key)
    ) {
      while (pending.size >= cap()) {
        pending.delete(pending.keys().next().value!);
      }
      pending.set(key, Date.now() + ttlMs());
      return id;
    }
  }
}

/** Resolves an echoed id to the store it names; counts a hit or miss and
 * refreshes recency. A TTL-expired entry is an evict plus a miss. */
export function resolveClaimSet(
  buildId: string,
  route: string,
  id: string,
): string | undefined {
  const key = claimSetKey(buildId, route, id);
  const entry = claimSets.get(key);
  if (entry) {
    claimSets.delete(key);
    if (entry.expires > Date.now()) {
      claimSets.set(key, entry);
      stats.hit++;
      return entry.store;
    }
    stats.evict++;
  }
  stats.miss++;
}

/** Binds a reserved id to the final store, once the render completed
 * successfully (the `onFeedback` moment). The bind consumes its
 * reservation exactly once; without a live one (aborted render never
 * binds, reservation expired/evicted, or already consumed) the bind is
 * discarded and the id stays a miss. */
export function bindClaimSet(
  buildId: string,
  route: string,
  id: string,
  store: string,
) {
  const key = claimSetKey(buildId, route, id);
  const reserved = pending.get(key);
  pending.delete(key);
  if (reserved === undefined || reserved <= Date.now()) return;
  // Evict in a loop: a live cap reduction must converge, not shed one.
  while (claimSets.size >= cap()) {
    claimSets.delete(claimSets.keys().next().value!);
    stats.evict++;
  }
  claimSets.set(key, { store, expires: Date.now() + ttlMs() });
}

/** Telemetry for probes and gates; `size` proves the map stays bounded. */
export function claimSetStats() {
  return { ...stats, size: claimSets.size, pending: pending.size };
}

/** Test seam: a fresh process (the worker-restart case). */
export function resetClaimSets() {
  claimSets.clear();
  pending.clear();
  stats.hit = stats.miss = stats.evict = 0;
  testCap = undefined;
  testTtlMs = undefined;
}

/** Test seam: injectable randomness to pin collision regeneration. */
export function setClaimSetRandomForTest(
  impl: ((bytes: number) => Buffer) | undefined,
) {
  random = impl || randomBytes;
}

/** Test seam: pin LRU/TTL bounds without shipping env config. */
export function setClaimSetBoundsForTest(
  bounds: { cap?: number; ttlMs?: number } | undefined,
) {
  testCap = bounds?.cap;
  testTtlMs = bounds?.ttlMs;
}

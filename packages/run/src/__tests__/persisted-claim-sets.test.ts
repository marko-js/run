import assert from "assert/strict";

import {
  bindClaimSet,
  claimSetStats,
  reserveClaimSetId,
  resetClaimSets,
  resolveClaimSet,
  setClaimSetBoundsForTest,
  setClaimSetRandomForTest,
} from "../runtime/claim-sets";
import { createContext, initializePersisted } from "../runtime/internal";
import {
  createPatchRequestHeaders,
  decodeClaimSetAck,
  encodeEcho,
} from "../runtime/persisted-protocol";
import {
  claim,
  CLAIM_A,
  CLAIM_A2,
  CLAIM_B,
  CLAIM_C,
  CLAIM_X,
} from "./utils/claims";

const BUILD = "current-build";

// Covers both `toReadable` branches; only headers/options are inspected.
const rendered = {
  toReadable: () =>
    new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.close();
      },
    }),
  async *[Symbol.asyncIterator]() {
    /* empty */
  },
};

/** One negotiated patch request through the real router internals: returns
 * the response, the render options marko would receive, and the ack. The
 * id rides its own request header; `values` becomes a plain E1 echo. */
function patchRequest({
  from = 2,
  to = 2,
  values,
  claimSetId,
  rawClaimSet,
  method = "GET",
}: {
  from?: number;
  to?: number;
  values?: string;
  claimSetId?: string;
  rawClaimSet?: string;
  method?: string;
} = {}) {
  const headers: Record<string, string> = createPatchRequestHeaders(
    to,
    from,
    BUILD,
  );
  if (values) {
    headers["x-marko-echo"] = encodeEcho({ regions: {} }, values)!.header;
  }
  if (claimSetId) headers["x-marko-claim-set"] = `E2.${claimSetId}`;
  if (rawClaimSet) headers["x-marko-claim-set"] = rawClaimSet;
  const ctx = createContext(
    null,
    new Request("http://localhost/reports", { headers, method }),
    {} as any,
  ) as any;
  const mismatch = initializePersisted(ctx, to, BUILD, [undefined, 1, 1, 1]);
  assert.equal(mismatch, undefined);
  let options: any;
  const response: Response = ctx.render(
    {
      render: (_input: unknown, next: unknown) => ((options = next), rendered),
    },
    {},
  );
  const ack = decodeClaimSetAck(response.headers.get("x-marko-claim-set"));
  return { response, options, ack };
}

/** The e1 fingerprint, implemented independently of the runtime so an
 * algorithm drift on either side fails loudly here. */
const fnv = (values: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < values.length; i++) {
    hash = Math.imul(hash ^ values.charCodeAt(i), 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

describe("server-issued claim sets (server)", () => {
  beforeEach(() => resetClaimSets());
  afterEach(() => {
    resetClaimSets();
    setClaimSetRandomForTest(undefined);
  });

  it("reserves an id before rendering and acks base=empty cold", () => {
    const { ack, options } = patchRequest();
    assert.ok(ack, "patch response carried no claim-set ack");
    assert.match(ack!.id, /^[\w-]{22}$/);
    assert.equal(ack!.base, "empty");
    assert.equal(typeof options.persisted.onFeedback, "function");
    // Reserved but not yet bound: the id resolves only after onFeedback.
    assert.equal(resolveClaimSet(BUILD, "2", ack!.id), undefined);
  });

  it("binds on feedback and serves the id back at full density", () => {
    const first = patchRequest();
    first.options.persisted.onFeedback(`${CLAIM_A}.${CLAIM_B}`);

    const second = patchRequest({ claimSetId: first.ack!.id });
    assert.equal(second.ack!.base, "hit");
    // The ack identifies the id it CONSUMED: the client commits the next
    // id only against a fingerprint of the one it sent.
    assert.equal(second.ack!.fp, fnv(first.ack!.id));
    // Marko receives the materialized store the id names — E1-shaped,
    // regardless of what fit in the request header.
    assert.equal(
      second.options.persisted.patch.echoValues,
      `${CLAIM_A}.${CLAIM_B}`,
    );
    // The next id chains: merge base is the resolved store.
    second.options.persisted.onFeedback(CLAIM_A2);
    const third = patchRequest({ claimSetId: second.ack!.id });
    assert.equal(third.ack!.base, "hit");
    assert.equal(
      third.options.persisted.patch.echoValues,
      `${CLAIM_B}.${CLAIM_A2}`,
    );
  });

  it("acks base=e1 with the consumed subset's fingerprint and merges into exactly it", () => {
    const { ack, options } = patchRequest({ values: `${CLAIM_A}.${CLAIM_B}` });
    assert.equal(ack!.base, "e1");
    // The fingerprint proves WHICH subset the server read: the client
    // refuses the id when this does not match what it transmitted.
    assert.equal(ack!.fp, fnv(`${CLAIM_A}.${CLAIM_B}`));
    assert.equal(options.persisted.patch.echoValues, `${CLAIM_A}.${CLAIM_B}`);
    options.persisted.onFeedback(CLAIM_C);
    assert.equal(
      resolveClaimSet(BUILD, "2", ack!.id),
      `${CLAIM_A}.${CLAIM_B}.${CLAIM_C}`,
    );
  });

  it("a hit ack fingerprints the substituted id, not the client's", () => {
    // Two live ids on one route naming different stores. A skewed worker
    // replays X on a request the client sent A for: the server merges
    // from store X, so its ack must name X — the proof that lets the
    // client (which sent A) refuse the resulting id instead of rebuilding
    // store A under an id the server bound from store X.
    const seedA = patchRequest();
    seedA.options.persisted.onFeedback(CLAIM_A);
    const seedX = patchRequest();
    seedX.options.persisted.onFeedback(CLAIM_X);
    const replayed = patchRequest({ claimSetId: seedX.ack!.id });
    assert.equal(replayed.ack!.base, "hit");
    assert.equal(replayed.ack!.fp, fnv(seedX.ack!.id));
    assert.notEqual(replayed.ack!.fp, fnv(seedA.ack!.id));
    assert.equal(replayed.options.persisted.patch.echoValues, CLAIM_X);
  });

  it("prefers a known id over the hedged enumeration", () => {
    const first = patchRequest();
    first.options.persisted.onFeedback(`${CLAIM_A}.${CLAIM_B}`);
    const { ack, options } = patchRequest({
      values: CLAIM_A,
      claimSetId: first.ack!.id,
    });
    assert.equal(ack!.base, "hit");
    assert.equal(
      options.persisted.patch.echoValues,
      `${CLAIM_A}.${CLAIM_B}`,
      "the id names the full store, not the header subset",
    );
  });

  it("an unknown, malformed, or percent-encoded id degrades to the hedge, never throws", () => {
    const unknown = patchRequest({
      values: CLAIM_A,
      claimSetId: "AAAAAAAAAAAAAAAAAAAAAA",
    });
    assert.equal(unknown.ack!.base, "e1");
    assert.equal(unknown.ack!.fp, fnv(CLAIM_A));
    assert.equal(unknown.options.persisted.patch.echoValues, CLAIM_A);
    // The raw grammar is validated BEFORE any decoding: a percent-encoded
    // lookalike of a BOUND id must not alias it (16 zero bytes mint
    // exactly "A"×22 in base64url).
    setClaimSetRandomForTest(() => Buffer.alloc(16, 0));
    const zeroId = reserveClaimSetId(BUILD, "2");
    setClaimSetRandomForTest(undefined);
    assert.equal(zeroId, "AAAAAAAAAAAAAAAAAAAAAA");
    bindClaimSet(BUILD, "2", zeroId, "boundStore");
    const percent = patchRequest({
      rawClaimSet: "E2." + "%41".repeat(22),
    });
    assert.equal(percent.ack!.base, "empty", "percent form aliased a real id");
    const hostile = patchRequest({ rawClaimSet: "E2.__proto__" });
    assert.equal(hostile.ack!.base, "empty");
    const genuine = patchRequest({ claimSetId: zeroId });
    assert.equal(genuine.ack!.base, "hit");
    const stats = claimSetStats();
    assert.equal(stats.miss, 1, "only the well-formed unknown id counts");
  });

  it("binds an id even for an empty-feedback (all-held) response", () => {
    const first = patchRequest();
    first.options.persisted.onFeedback(CLAIM_A);
    const second = patchRequest({
      values: CLAIM_A,
      claimSetId: first.ack!.id,
    });
    assert.equal(second.ack!.base, "hit");
    // Everything held: the delta is empty, the store carries over whole.
    second.options.persisted.onFeedback("");
    assert.equal(resolveClaimSet(BUILD, "2", second.ack!.id), CLAIM_A);
  });

  it("ignores a known id cross-route and mints a route-clean store", () => {
    const first = patchRequest();
    first.options.persisted.onFeedback("oldRouteA");
    // 2 -> 3: marko refuses cross-route claims; the server must not merge
    // the old route's store into the new id.
    const cross = patchRequest({
      from: 2,
      to: 3,
      values: "oldRouteA",
      claimSetId: first.ack!.id,
    });
    assert.equal(cross.ack!.base, "empty");
    cross.options.persisted.onFeedback("newRouteB");
    assert.equal(resolveClaimSet(BUILD, "3", cross.ack!.id), "newRouteB");
    // The old id also never resolves under the new route's scope.
    assert.equal(resolveClaimSet(BUILD, "3", first.ack!.id), undefined);
  });

  it("an aborted render never binds its reserved id", () => {
    const { ack } = patchRequest();
    // onFeedback never fires (stream aborted): the id stays a miss.
    assert.equal(resolveClaimSet(BUILD, "2", ack!.id), undefined);
    const retry = patchRequest({ claimSetId: ack!.id });
    assert.equal(retry.ack!.base, "empty");
  });

  it("two pre-bind reservations never share an id", () => {
    // The report's reproduction: with only bound entries checked, two
    // renders in flight could mint the SAME id and their binds would
    // overwrite each other — a false hit across two tabs. Reservations
    // must collide atomically at reserve time.
    const canned = [
      Buffer.alloc(16, 1),
      Buffer.alloc(16, 1),
      Buffer.alloc(16, 2),
    ];
    setClaimSetRandomForTest(() => canned.shift()!);
    const first = reserveClaimSetId(BUILD, "2");
    const second = reserveClaimSetId(BUILD, "2");
    assert.notEqual(second, first, "concurrent reservations shared an id");
    assert.equal(canned.length, 0, "regeneration consumed the extra draw");
    bindClaimSet(BUILD, "2", first, "storeAAA");
    bindClaimSet(BUILD, "2", second, "storeBBB");
    assert.equal(resolveClaimSet(BUILD, "2", first), "storeAAA");
    assert.equal(resolveClaimSet(BUILD, "2", second), "storeBBB");
  });

  it("a bind consumes its reservation exactly once", () => {
    const id = reserveClaimSetId(BUILD, "2");
    bindClaimSet(BUILD, "2", id, "storeAAA");
    // A second bind has no reservation to consume: discarded, the first
    // binding stands.
    bindClaimSet(BUILD, "2", id, "storeBBB");
    assert.equal(resolveClaimSet(BUILD, "2", id), "storeAAA");
  });

  it("a bind whose reservation expired is discarded", async () => {
    setClaimSetBoundsForTest({ ttlMs: 1 });
    const id = reserveClaimSetId(BUILD, "2");
    await new Promise((resolve) => setTimeout(resolve, 5));
    bindClaimSet(BUILD, "2", id, "staleStore");
    assert.equal(
      resolveClaimSet(BUILD, "2", id),
      undefined,
      "an expired reservation must not bind",
    );
  });

  // Two keys: the shared seed and the per-tab fork (the forks share a
  // key, but each lands in its own store).
  const SHARED = claim("s", "A");
  const FORK_A = claim("f", "A");
  const FORK_B = claim("f", "B");
  it("two tabs may fork one id; neither corrupts the other", () => {
    const first = patchRequest();
    first.options.persisted.onFeedback(SHARED);
    const tabA = patchRequest({ claimSetId: first.ack!.id });
    const tabB = patchRequest({ claimSetId: first.ack!.id });
    assert.equal(tabA.ack!.base, "hit");
    assert.equal(tabB.ack!.base, "hit");
    assert.notEqual(tabA.ack!.id, tabB.ack!.id);
    tabA.options.persisted.onFeedback(FORK_A);
    tabB.options.persisted.onFeedback(FORK_B);
    assert.equal(
      resolveClaimSet(BUILD, "2", tabA.ack!.id),
      `${SHARED}.${FORK_A}`,
    );
    assert.equal(
      resolveClaimSet(BUILD, "2", tabB.ack!.id),
      `${SHARED}.${FORK_B}`,
    );
    assert.equal(resolveClaimSet(BUILD, "2", first.ack!.id), SHARED);
  });

  it("regenerates on an injected RNG collision with a bound id", () => {
    const canned = [
      Buffer.alloc(16, 1),
      Buffer.alloc(16, 1),
      Buffer.alloc(16, 2),
    ];
    setClaimSetRandomForTest(() => canned.shift()!);
    const first = reserveClaimSetId(BUILD, "2");
    bindClaimSet(BUILD, "2", first, "storeAAA");
    const second = reserveClaimSetId(BUILD, "2");
    assert.notEqual(second, first, "colliding id must regenerate");
    assert.equal(canned.length, 0, "regeneration consumed the extra draw");
    assert.equal(resolveClaimSet(BUILD, "2", first), "storeAAA");
  });

  it("worker restart forgets every id", () => {
    const { ack, options } = patchRequest();
    options.persisted.onFeedback(CLAIM_A);
    resetClaimSets();
    const retry = patchRequest({ values: CLAIM_A, claimSetId: ack!.id });
    assert.equal(retry.ack!.base, "e1", "a restarted worker degrades to E1");
  });

  it("stays bounded under churn, evicting oldest-first", () => {
    // Entry-count and store-length bounds are a PROXY for the binding
    // brief's heap ceiling: JS Map/string overhead is not measured here,
    // so this pins boundedness (cap * store size), not resident bytes.
    setClaimSetBoundsForTest({ cap: 8 });
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      const id = reserveClaimSetId(BUILD, "2");
      ids.push(id);
      bindClaimSet(BUILD, "2", id, `store-${i}` + "X".repeat(900));
    }
    const stats = claimSetStats();
    assert.equal(stats.size, 8, "map exceeded its cap under churn");
    assert.equal(stats.evict, 92);
    assert.ok(stats.pending <= 8, "pending reservations exceeded the cap");
    assert.equal(resolveClaimSet(BUILD, "2", ids[0]), undefined);
    assert.equal(
      resolveClaimSet(BUILD, "2", ids[99]),
      `store-99` + "X".repeat(900),
    );
  });

  it("a live cap reduction converges the map, not one eviction per bind", () => {
    setClaimSetBoundsForTest({ cap: 10 });
    for (let i = 0; i < 10; i++) {
      bindClaimSet(BUILD, "2", reserveClaimSetId(BUILD, "2"), `store-${i}`);
    }
    assert.equal(claimSetStats().size, 10);
    setClaimSetBoundsForTest({ cap: 2 });
    bindClaimSet(BUILD, "2", reserveClaimSetId(BUILD, "2"), "store-after");
    assert.ok(
      claimSetStats().size <= 2,
      `cap reduction left size ${claimSetStats().size}`,
    );
  });

  it("a hit refreshes recency; an expired entry is an evicting miss", async () => {
    setClaimSetBoundsForTest({ cap: 2 });
    const a = reserveClaimSetId(BUILD, "2");
    bindClaimSet(BUILD, "2", a, "storeAAA");
    const b = reserveClaimSetId(BUILD, "2");
    bindClaimSet(BUILD, "2", b, "storeBBB");
    // Touch a so b is now least recently used.
    assert.equal(resolveClaimSet(BUILD, "2", a), "storeAAA");
    const c = reserveClaimSetId(BUILD, "2");
    bindClaimSet(BUILD, "2", c, "storeCCC");
    assert.equal(resolveClaimSet(BUILD, "2", a), "storeAAA");
    assert.equal(resolveClaimSet(BUILD, "2", b), undefined, "LRU evicts b");

    setClaimSetBoundsForTest({ cap: 2, ttlMs: 1 });
    const d = reserveClaimSetId(BUILD, "2");
    bindClaimSet(BUILD, "2", d, "storeDDD");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const before = claimSetStats().evict;
    assert.equal(resolveClaimSet(BUILD, "2", d), undefined, "TTL expiry");
    assert.equal(claimSetStats().evict, before + 1);
  });
});

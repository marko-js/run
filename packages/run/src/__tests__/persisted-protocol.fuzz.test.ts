import assert from "assert/strict";

import {
  decodeClaimSetAck,
  decodeClaimSetRequest,
  decodeEcho,
  digestWidth,
  echoValuesCap,
  encodeEcho,
  feedbackLinePrefix,
  fingerprintValues,
  mergeValueFeedback,
  valueStoreCap,
} from "../runtime/persisted-protocol";

// Deterministic so a failure is reproducible from its printed seed.
function rng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1e6) / 1e6;
  };
}

// Characters chosen to attack the codec's own escaping: the record and
// section separators, the escape character itself, and multi-byte code
// points whose percent-encoding multiplies length.
const HOSTILE = [
  ".",
  "%",
  ";",
  "|",
  "%2E",
  "%25",
  '"',
  "\\",
  "\n",
  "é",
  "中",
  "🙈",
  " ",
];

const DIGEST_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function makeDigest(next: () => number) {
  let out = "";
  for (let i = 0; i < digestWidth; i++) {
    out += DIGEST_CHARS[Math.floor(next() * DIGEST_CHARS.length)];
  }
  return out;
}

function makeKey(next: () => number) {
  const length = 1 + Math.floor(next() * 12);
  let out = "";
  for (let i = 0; i < length; i++) {
    out +=
      next() < 0.35
        ? HOSTILE[Math.floor(next() * HOSTILE.length)]
        : String.fromCharCode(97 + Math.floor(next() * 26));
  }
  return out;
}

// The server escapes `%` and `.` in keys before joining records with `.`.
const escapeKey = (key: string) =>
  key.replace(/%/g, "%25").replace(/\./g, "%2E");

function makeValueSection(next: () => number, count: number) {
  const records: string[] = [];
  for (let i = 0; i < count; i++) {
    records.push(escapeKey(makeKey(next)) + makeDigest(next));
  }
  return records;
}

function makeRegions(next: () => number, count: number) {
  const regions: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    regions[makeKey(next) + "|" + makeKey(next)] = makeDigest(next);
  }
  return regions;
}

describe("persisted echo envelope (fuzz)", () => {
  it("never emits an envelope it cannot decode", () => {
    let shed = 0;
    let emitted = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const next = rng(seed);
      const records = makeValueSection(next, Math.floor(next() * 24));
      const regions = makeRegions(next, Math.floor(next() * 12));
      const encoded = encodeEcho({ regions }, records.join(".") || undefined);
      if (encoded === undefined) continue;
      const decoded = decodeEcho(encoded.header);
      assert.ok(decoded, `seed ${seed}: encoded envelope failed to decode`);
      emitted++;
      const kept = decoded.values ? decoded.values.split(".").length : 0;
      assert.equal(
        decoded.values || "",
        encoded.values,
        `seed ${seed}: sent-records return diverged from the wire`,
      );
      if (kept < records.length) shed++;
    }
    // A corpus that never overflows the field would test nothing: the
    // shedding path is the one this suite exists for.
    assert.ok(emitted > 200, `corpus emitted only ${emitted} envelopes`);
    assert.ok(shed > 20, `corpus exercised shedding only ${shed} times`);
  });

  it("fingerprints the sent subset identically on both sides", () => {
    // The e1 ack's proof: server fingerprints what it decoded, client
    // what it sent — they must agree for every survivable envelope.
    let checked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const next = rng(seed);
      const records = makeValueSection(next, 1 + Math.floor(next() * 24));
      const regions = makeRegions(next, Math.floor(next() * 12));
      const encoded = encodeEcho({ regions }, records.join("."));
      if (encoded === undefined) continue;
      const decoded = decodeEcho(encoded.header);
      assert.ok(decoded, `seed ${seed}: envelope failed to decode`);
      assert.equal(
        fingerprintValues(decoded.values || ""),
        fingerprintValues(encoded.values),
        `seed ${seed}: fingerprint diverged across the wire`,
      );
      checked++;
    }
    assert.ok(checked > 200, `corpus checked only ${checked} envelopes`);
  });

  it("keeps every surviving value record byte-identical", () => {
    let checked = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const next = rng(seed);
      const records = makeValueSection(next, 1 + Math.floor(next() * 24));
      const encoded = encodeEcho(
        { regions: makeRegions(next, Math.floor(next() * 8)) },
        records.join("."),
      );
      if (encoded === undefined) continue;
      const kept = decodeEcho(encoded.header)!.values;
      if (!kept) continue;
      // Shedding may drop records, never rewrite them, and never reorder
      // the ones it keeps: a claim the server reads must be exactly the
      // claim the client committed.
      const keptRecords = kept.split(".");
      let cursor = 0;
      for (const record of keptRecords) {
        const at = records.indexOf(record, cursor);
        assert.notEqual(
          at,
          -1,
          `seed ${seed}: decoded a record the client never sent: ${record}`,
        );
        cursor = at + 1;
      }
      checked += keptRecords.length;
    }
    assert.ok(checked > 500, `corpus checked only ${checked} records`);
  });

  it("keeps every surviving region claim readable at its own identity", () => {
    let survived = 0;
    let shedTotal = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const next = rng(seed);
      // Wide enough that a regions-only envelope overflows the field cap
      // for a healthy share of seeds: both survival and shedding must be
      // exercised, or half the property is untested.
      const regions = makeRegions(next, 1 + Math.floor(next() * 24));
      const encoded = encodeEcho({ regions }, undefined);
      if (encoded === undefined) continue;
      const lookup = decodeEcho(encoded.header)!.regions;
      assert.ok(lookup, `seed ${seed}: envelope decoded without regions`);
      // The lookup token is the FULL identity (keys embed "|", so it must
      // never be re-split), and shedding drops lowest-benefit-last: the
      // survivors are a prefix of the snapshot's benefit order. Each one
      // must read back byte-identical — a WRONG digest would make the
      // server hold content the client does not have — and after the
      // first shed claim every later one must be absent too.
      let shed = false;
      for (const [identity, digest] of Object.entries(regions)) {
        const read = lookup(identity);
        if (read === undefined) {
          shed = true;
          shedTotal++;
        } else {
          assert.ok(
            !shed,
            `seed ${seed}: region ${identity} survived after an earlier claim shed`,
          );
          assert.equal(
            read,
            digest,
            `seed ${seed}: region ${identity} decoded as ${read} (sent ${digest})`,
          );
          survived++;
        }
      }
    }
    // The corpus must exercise both outcomes — and a lookup that always
    // misses (the vacuous bug this replaced) now fails loudly.
    assert.ok(survived > 500, `corpus verified only ${survived} claims`);
    assert.ok(shedTotal > 20, `corpus exercised shedding only ${shedTotal}x`);
  });

  it("survives arbitrary hostile header values without throwing", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const next = rng(seed);
      const length = Math.floor(next() * 600);
      let garbage = "";
      for (let i = 0; i < length; i++) {
        garbage +=
          next() < 0.5
            ? HOSTILE[Math.floor(next() * HOSTILE.length)]
            : String.fromCharCode(32 + Math.floor(next() * 95));
      }
      // A hostile echo is client-controlled input: it may decode to
      // nothing, but it must never throw and never take the server down.
      assert.doesNotThrow(() => decodeEcho(garbage), `seed ${seed}`);
      // The same garbage as the request-side claim-set header: only the
      // exact raw fixed-length grammar yields an id — never a throw, and
      // never a percent-decoded alias.
      assert.doesNotThrow(() => {
        const id = decodeClaimSetRequest("E2." + garbage.slice(0, 60));
        assert.ok(
          id === undefined || /^[\w-]{22}$/.test(id),
          `seed ${seed}: hostile input yielded a malformed id`,
        );
      }, `seed ${seed}`);
      // And as a claim-set ack: anything but the exact grammar means the
      // channel is off for that response.
      assert.doesNotThrow(() => decodeClaimSetAck(garbage), `seed ${seed}`);
    }
  });
});

describe("persisted value feedback merge (fuzz)", () => {
  it("keeps absent entries, replaces present ones, and stays capped", () => {
    let capped = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const next = rng(seed);
      // Wide enough to cross the 256-entry store cap: eviction order is
      // part of the contract, so the corpus has to reach it.
      const committed = makeValueSection(next, Math.floor(next() * 300));
      const feedback = makeValueSection(next, 1 + Math.floor(next() * 160));
      const merged = mergeValueFeedback(
        committed.join(".") || undefined,
        feedback.join("."),
      );
      const entries = merged ? merged.split(".") : [];
      assert.ok(
        entries.length <= valueStoreCap,
        `seed ${seed}: store exceeded its cap`,
      );
      capped += entries.length === valueStoreCap ? 1 : 0;
      // Every feedback record that fits must be present verbatim: the
      // store is the client's possession record, not a summary.
      const keys = new Set(
        entries.map((entry) => entry.slice(0, -digestWidth)),
      );
      for (const record of feedback.slice(-valueStoreCap)) {
        assert.ok(
          keys.has(record.slice(0, -digestWidth)),
          `seed ${seed}: feedback record dropped: ${record}`,
        );
      }
      // One key never appears twice — a duplicate would make the server's
      // claim lookup order-dependent.
      assert.equal(keys.size, entries.length, `seed ${seed}: duplicate key`);
    }
    assert.ok(capped > 5, `corpus hit the entry cap only ${capped} times`);
  });

  it("is idempotent when the same feedback repeats", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const next = rng(seed);
      const committed = makeValueSection(next, Math.floor(next() * 20));
      const feedback = makeValueSection(next, 1 + Math.floor(next() * 10));
      const once = mergeValueFeedback(
        committed.join(".") || undefined,
        feedback.join("."),
      );
      const twice = mergeValueFeedback(once, feedback.join("."));
      assert.equal(twice, once, `seed ${seed}: merge is not idempotent`);
    }
  });
});

// Tripwires, not preferences: each constant below mirrors one in marko's
// runtime, and the pair must move together — drift does not error, it
// silently stops claims from matching. Changing a value is expected;
// changing it on one side only is the bug these exist to catch.
describe("mirrored protocol constants", () => {
  // Mirrors marko's DIGEST_WIDTH (packages/runtime-tags/src/common/
  // value-claims.ts), which slices claim keys by the same number.
  it("agrees with marko's DIGEST_WIDTH", () => {
    assert.equal(digestWidth, 16);
  });

  // Kept in lockstep with marko's FEEDBACK_CAP (html/patch-groups.ts).
  it("agrees with marko's FEEDBACK_CAP", () => {
    assert.equal(echoValuesCap, 720);
  });

  // Kept in lockstep with marko's FEEDBACK_PREFIX (html/patch-groups.ts).
  it("agrees with marko's FEEDBACK_PREFIX", () => {
    assert.equal(feedbackLinePrefix, "//E1:");
  });

  it("pins the fixed protocol constants", () => {
    assert.equal(digestWidth, 16);
    assert.equal(valueStoreCap, 256);
    assert.equal(echoValuesCap, 720);
  });

  // Kept in lockstep with marko's committed-store cap (value-claims.ts).
  it("agrees with marko's 256-entry committed-store cap", () => {
    const feedback = Array.from(
      { length: 300 },
      (_, i) => `k${i}` + "A".repeat(digestWidth),
    ).join(".");
    const merged = mergeValueFeedback(
      "seed" + "B".repeat(digestWidth),
      feedback,
    );
    assert.equal(merged!.split(".").length, 256);
  });
});

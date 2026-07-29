import assert from "assert/strict";

import {
  claimSetIdLength,
  decodeClaimSetAck,
  decodeClaimSetRequest,
  decodeEcho,
  digestWidth,
  echoValuesCap,
  encodeClaimSetAck,
  encodeClaimSetRequest,
  encodeEcho,
  fingerprintValues,
  persistedHeaders,
} from "../runtime/persisted-protocol";
import { CLAIM_A, CLAIM_B } from "./utils/claims";

const CLAIM_SET_ID = "abcDEF0123456789_-abcd";

describe("persisted echo envelope", () => {
  it("round-trips regions and values", () => {
    const encoded = encodeEcho(
      { regions: { 'a5|k"two"|b0': "g51fb7UUSqX8g5rz" } },
      "c-section-payload",
    )!;
    const decoded = decodeEcho(encoded.header)!;
    assert.equal(decoded.values, "c-section-payload");
    assert.equal(encoded.values, "c-section-payload");
    assert.equal(decoded.regions!('a5|k"two"|b0'), "g51fb7UUSqX8g5rz");
    assert.equal(decoded.regions!("a5|other"), undefined);
  });

  it("sends nothing when there is nothing to assert", () => {
    assert.equal(encodeEcho(undefined, undefined), undefined);
    assert.equal(encodeEcho({ regions: {} }, undefined), undefined);
  });

  it("keeps the whole HTTP/1 field within 511 bytes, shedding regions", () => {
    const regions: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      regions[`a5|k"item-${i}"`] = "0123456789abcdef";
    }
    const encoded = encodeEcho({ regions }, "values")!;
    assert.ok(
      `${persistedHeaders.echo}: ${encoded.header}\r\n`.length <= 511,
      `field is ${encoded.header.length + 16} bytes`,
    );
    // Shed entries are misses, not corruption: what remains still decodes.
    const decoded = decodeEcho(encoded.header)!;
    assert.equal(decoded.values, "values");
    assert.equal(decoded.regions!('a5|k"item-0"'), "0123456789abcdef");
  });

  it("sheds the value section before all but the top region claim", () => {
    // A cap-sized value section with several claims: the wrap must fit AND
    // retain region claims — values shed before B, not the reverse.
    const regions: Record<string, string> = {};
    for (let i = 0; i < 6; i++) {
      regions[`a5|k"category-item-${i}"|b0`] = "0123456789abcdef";
    }
    const encoded = encodeEcho({ regions }, "v".repeat(echoValuesCap))!;
    assert.ok(`${persistedHeaders.echo}: ${encoded.header}\r\n`.length <= 511);
    const decoded = decodeEcho(encoded.header)!;
    assert.equal(
      decoded.regions!('a5|k"category-item-0"|b0'),
      "0123456789abcdef",
      "the top region claim must survive a full value section",
    );
  });

  it("sheds cap-sized value feedback to whole records, never corruption", () => {
    // The feedback budget deliberately exceeds the field cap (the surplus
    // is redeemed through a claim-set id), so the wrap sheds — but a real
    // section is dot-separated records and must shed at those boundaries.
    const records: string[] = [];
    while (records.join(".").length < echoValuesCap) {
      records.push(`k${records.length}` + "A".repeat(digestWidth));
    }
    const section = records.join(".").slice(0, echoValuesCap);
    const encoded = encodeEcho(undefined, section)!;
    assert.ok(`${persistedHeaders.echo}: ${encoded.header}\r\n`.length <= 511);
    const kept = decodeEcho(encoded.header)!.values!.split(".");
    assert.ok(kept.length > 0 && kept.length < records.length, "shed a prefix");
    assert.deepEqual(kept, records.slice(0, kept.length), "whole records only");
  });

  it("treats an oversize section with no record boundary as a miss", () => {
    // No record boundary to shed at: the section drops whole rather than
    // emitting a truncated — and therefore corrupt — claim.
    const encoded = encodeEcho(undefined, "v".repeat(echoValuesCap))!;
    assert.ok(`${persistedHeaders.echo}: ${encoded.header}\r\n`.length <= 511);
    assert.equal(decodeEcho(encoded.header)!.values, undefined);
  });

  it("treats malformed or oversize echoes as a miss", () => {
    assert.equal(decodeEcho(null), undefined);
    assert.equal(decodeEcho("E1." + "A".repeat(600)), undefined);
    // A broken percent sequence is a miss, never a throw.
    assert.equal(decodeEcho("E1.%zz;a|b"), undefined);
    // Free-text values decode as an opaque section; the claims codec
    // downstream treats anything malformed as a miss.
    assert.equal(decodeEcho("E1.free-text")!.values, "free-text");
  });

  it("preserves multibyte region keys", () => {
    const key = 'a5|k"héllo–🌍"';
    const encoded = encodeEcho(
      { regions: { [key]: "0123456789abcdef" } },
      undefined,
    )!;
    assert.equal(
      decodeEcho(encoded.header)!.regions!('a5|k"héllo–🌍"'),
      "0123456789abcdef",
    );
  });
});

describe("persisted echo sent-records return", () => {
  it("returns exactly the transmitted (post-shed) record subset", () => {
    // More records than the field can carry: the sent-records return must
    // name the survivors byte-for-byte — it is the client's rebuild base
    // when the server acks base=e1 (whose fingerprint covers it).
    const records = Array.from(
      { length: 60 },
      (_, i) => `key-${i}-x` + "D".repeat(digestWidth),
    );
    const encoded = encodeEcho({ regions: {} }, records.join("."))!;
    assert.ok(
      `${persistedHeaders.echo}: ${encoded.header}\r\n`.length <= 511,
      `field is ${encoded.header.length + 16} bytes`,
    );
    const sent = encoded.values.split(".");
    assert.ok(sent.length < records.length, "corpus never shed");
    assert.ok(sent.length > 10, "corpus transmitted almost nothing");
    const decoded = decodeEcho(encoded.header)!;
    assert.equal(decoded.values, encoded.values);
    // Both sides fingerprint the same subset to the same value.
    assert.equal(
      fingerprintValues(decoded.values!),
      fingerprintValues(encoded.values),
    );
    // Survivors are a subsequence of the store, never rewritten.
    let cursor = 0;
    for (const record of sent) {
      const at = records.indexOf(record, cursor);
      assert.notEqual(at, -1, `transmitted a record never offered: ${record}`);
      cursor = at + 1;
    }
  });

  it("keeps the echo pure E1: an E2-prefixed echo is a total miss", () => {
    // The claim-set id rides its own header; nothing E2-shaped is valid
    // in the echo (so the hedge is byte-identical to an id-less client).
    assert.equal(decodeEcho(`E2.${CLAIM_SET_ID}`), undefined);
    assert.equal(decodeEcho(`E2.${CLAIM_SET_ID}.${CLAIM_A}`), undefined);
  });
});

describe("persisted claim-set request header", () => {
  it("round-trips a well-formed id", () => {
    const encoded = encodeClaimSetRequest(CLAIM_SET_ID);
    assert.equal(encoded, `E2.${CLAIM_SET_ID}`);
    assert.equal(decodeClaimSetRequest(encoded), CLAIM_SET_ID);
  });

  it("accepts only the exact raw grammar — percent forms never alias", () => {
    assert.equal(decodeClaimSetRequest(null), undefined);
    assert.equal(decodeClaimSetRequest(""), undefined);
    assert.equal(decodeClaimSetRequest(CLAIM_SET_ID), undefined);
    assert.equal(decodeClaimSetRequest("E2.short"), undefined);
    assert.equal(decodeClaimSetRequest(`E2.${CLAIM_SET_ID}.extra`), undefined);
    assert.equal(decodeClaimSetRequest(`E1.${CLAIM_SET_ID}`), undefined);
    // Raw validation happens BEFORE any decoding: "%41"×22 must not
    // resolve as "A"×22.
    assert.equal(decodeClaimSetRequest("E2." + "%41".repeat(22)), undefined);
    assert.equal(
      decodeClaimSetRequest("E2." + "!".repeat(claimSetIdLength)),
      undefined,
    );
  });
});

describe("persisted claim-set ack header", () => {
  it("round-trips every base (hit and e1 carry their base fingerprint)", () => {
    assert.deepEqual(
      decodeClaimSetAck(encodeClaimSetAck(CLAIM_SET_ID, "empty")),
      {
        id: CLAIM_SET_ID,
        base: "empty",
        fp: undefined,
      },
    );
    // `hit` fingerprints the consumed id, `e1` the consumed record subset.
    const hitFp = fingerprintValues(CLAIM_SET_ID);
    assert.deepEqual(
      decodeClaimSetAck(encodeClaimSetAck(CLAIM_SET_ID, "hit", hitFp)),
      { id: CLAIM_SET_ID, base: "hit", fp: hitFp },
    );
    const fp = fingerprintValues(`${CLAIM_A}.${CLAIM_B}`);
    const encoded = encodeClaimSetAck(CLAIM_SET_ID, "e1", fp);
    assert.deepEqual(decodeClaimSetAck(encoded), {
      id: CLAIM_SET_ID,
      base: "e1",
      fp,
    });
  });

  it("treats malformed acks as channel-off", () => {
    assert.equal(decodeClaimSetAck(null), undefined);
    assert.equal(decodeClaimSetAck(""), undefined);
    assert.equal(decodeClaimSetAck(`E2.${CLAIM_SET_ID}`), undefined);
    assert.equal(decodeClaimSetAck(`E2.${CLAIM_SET_ID};base=full`), undefined);
    assert.equal(decodeClaimSetAck(`E2.short;base=hit`), undefined);
    assert.equal(decodeClaimSetAck(`E1.${CLAIM_SET_ID};base=hit`), undefined);
    // A hit or e1 ack without its fingerprint identifies no base at all:
    // malformed, so the client keeps plain E1 semantics.
    assert.equal(decodeClaimSetAck(`E2.${CLAIM_SET_ID};base=e1`), undefined);
    assert.equal(decodeClaimSetAck(`E2.${CLAIM_SET_ID};base=hit`), undefined);
    assert.equal(
      decodeClaimSetAck(`E2.${CLAIM_SET_ID};base=empty;fp=abc`),
      undefined,
    );
    assert.equal(
      decodeClaimSetAck(`E2.${"!".repeat(claimSetIdLength)};base=hit;fp=abc`),
      undefined,
    );
  });

  it("fingerprints deterministically with 32-bit math", () => {
    assert.equal(fingerprintValues(""), fingerprintValues(""));
    assert.notEqual(fingerprintValues(CLAIM_A), fingerprintValues(CLAIM_B));
    assert.match(fingerprintValues("x".repeat(500)), /^[0-9a-z]{1,7}$/);
  });
});

import assert from "assert/strict";

import {
  decodeEcho,
  encodeEcho,
  persistedHeaders,
} from "../runtime/persisted-protocol";

describe("persisted echo envelope", () => {
  it("round-trips regions and values", () => {
    const encoded = encodeEcho(
      { regions: { 'a5|k"two"|b0': "g51fb7UUSqX8g5rz" } },
      "c-section-payload",
    )!;
    const decoded = decodeEcho(encoded)!;
    assert.equal(decoded.values, "c-section-payload");
    assert.equal(decoded.regions!("a5", 'k"two"|b0'), "g51fb7UUSqX8g5rz");
    assert.equal(decoded.regions!("a5", "other"), undefined);
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
      `${persistedHeaders.echo}: ${encoded}\r\n`.length <= 511,
      `field is ${encoded.length + 16} bytes`,
    );
    // Shed entries are misses, not corruption: what remains still decodes.
    const decoded = decodeEcho(encoded)!;
    assert.equal(decoded.values, "values");
    assert.equal(decoded.regions!("a5", 'k"item-0"'), "0123456789abcdef");
  });

  it("treats malformed or oversize echoes as a miss", () => {
    assert.equal(decodeEcho(null), undefined);
    assert.equal(decodeEcho("E2.whatever"), undefined);
    assert.equal(decodeEcho("E1.!!!not-base64!!!"), undefined);
    assert.equal(decodeEcho("E1." + "A".repeat(600)), undefined);
    // A syntactically valid envelope with a non-array payload is a miss.
    assert.equal(
      decodeEcho("E1." + Buffer.from("{}").toString("base64url")),
      undefined,
    );
  });

  it("preserves multibyte region keys", () => {
    const key = 'a5|k"héllo–🌍"';
    const encoded = encodeEcho(
      { regions: { [key]: "0123456789abcdef" } },
      undefined,
    )!;
    assert.equal(
      decodeEcho(encoded)!.regions!("a5", 'k"héllo–🌍"'),
      "0123456789abcdef",
    );
  });
});

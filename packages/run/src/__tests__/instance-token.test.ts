import { createHmac } from "node:crypto";

import assert from "assert/strict";

import {
  computeInstanceTokenForTest as computeInstanceToken,
  instanceTokenForTest as instanceToken,
  instanceTokenMemoSize,
  resetInstanceTokens,
} from "../runtime/internal";

// A wire identity: compile site plus the region instance path.
const identity = (n: number) => `m4|k${n}|1g5spfn`;

describe("instance token memo", () => {
  beforeEach(resetInstanceTokens);

  it("is stable for an identity, which is what the echo depends on", () => {
    assert.equal(instanceToken(identity(1)), instanceToken(identity(1)));
  });

  it("separates distinct identities", () => {
    assert.notEqual(instanceToken(identity(1)), instanceToken(identity(2)));
  });

  it("stays bounded: identities are per item, param and user", () => {
    for (let i = 0; i < 25_000; i++) instanceToken(identity(i));
    assert.ok(
      instanceTokenMemoSize() <= 10_000,
      `memo grew to ${instanceTokenMemoSize()}`,
    );
  });

  // The cap is only safe because the token is a pure function of the
  // identity: an evicted entry must come back byte-identical, or a client's
  // echo would stop resolving mid-session.
  it("recomputes an evicted identity to the same token", () => {
    const before = instanceToken(identity(0));
    for (let i = 1; i < 25_000; i++) instanceToken(identity(i));
    assert.equal(instanceToken(identity(0)), before);
  });

  // Every step of the old FNV-1a construction was invertible, so one
  // observed token for a guessable identity recovered the post-secret
  // state and with it every other identity's token. The token must be a
  // real PRF (HMAC-SHA-256, truncated to the same wire width).
  it("is HMAC-SHA-256, not the old invertible FNV-1a", () => {
    const secret = "letmein";
    const id = identity(1);
    let fnv = 0x811c9dc5;
    const input = secret + "\0" + id;
    for (let i = 0; i < input.length; i++) {
      fnv = Math.imul(fnv ^ input.charCodeAt(i), 0x01000193) >>> 0;
    }
    const token = computeInstanceToken(secret, id);
    assert.notEqual(token, fnv.toString(36));
    assert.equal(
      token,
      createHmac("sha256", secret)
        .update(id)
        .digest()
        .readUInt32BE(0)
        .toString(36),
    );
  });
});

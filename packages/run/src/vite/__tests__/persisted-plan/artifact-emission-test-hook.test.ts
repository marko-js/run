import assert from "assert";

import {
  getArtifactEmissionForTest,
  setArtifactEmissionForTest,
} from "../../persisted-plan/artifact-emission-test-hook";

/** Mirrors plugin.ts product rule for emission (unit-tested in isolation). */
function emissionActive(persisted: boolean): boolean {
  const override = getArtifactEmissionForTest();
  return persisted && (override === undefined ? true : override);
}

describe("artifact emission test hook (W1)", () => {
  afterEach(() => {
    setArtifactEmissionForTest(undefined);
  });

  it("product default: emission on when persisted, no override", () => {
    assert.equal(getArtifactEmissionForTest(), undefined);
    assert.equal(emissionActive(true), true);
    assert.equal(emissionActive(false), false);
  });

  it("setArtifactEmissionForTest(false) forces dual (emission off)", () => {
    setArtifactEmissionForTest(false);
    assert.equal(emissionActive(true), false);
  });

  it("setArtifactEmissionForTest(true) keeps emission on under persisted", () => {
    setArtifactEmissionForTest(true);
    assert.equal(emissionActive(true), true);
  });
});

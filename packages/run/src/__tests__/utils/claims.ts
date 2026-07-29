import { digestWidth } from "../../runtime/persisted-protocol";

/** A wire claim record is `<key><digest>`, the digest exactly `digestWidth`
 * characters. Deriving the fixtures keeps the suites honest when the width
 * moves — a hardcoded digest mis-slices into an empty key instead. */
export const claim = (key: string, fill: string) =>
  key + fill.repeat(digestWidth);

export const CLAIM_A = claim("a", "A");
/** Key `a` again, a different digest: the replace-in-place case. */
export const CLAIM_A2 = claim("a", "C");
export const CLAIM_B = claim("b", "B");
export const CLAIM_C = claim("c", "D");
export const CLAIM_X = claim("x", "X");
export const CLAIM_Z = claim("z", "Z");

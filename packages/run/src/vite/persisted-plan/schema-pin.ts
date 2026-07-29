// The single normative source of `preliminary-plan@1.1` is the FROZEN marko
// repo module (marko `3bcf2934b9`,
// `packages/runtime-tags/src/translator/util/preliminary-plan.ts`). The
// sibling `./preliminary-plan.ts` here is a byte-identical vendored pin —
// never a second live definition (B1 residue 9). The pin test hashes the
// vendored bytes against this constant (red on ANY drift) and, when the
// frozen marko checkout is reachable, against the live file too.
export const PRELIMINARY_PLAN_SCHEMA_SHA256 =
  "d3ddb1903060feb7ff7a394d3896dcebb441dd7feb83a908c4797cd0da60ba00";

export const PRELIMINARY_PLAN_SCHEMA_SOURCE =
  "marko@3bcf2934b9:packages/runtime-tags/src/translator/util/preliminary-plan.ts";

import assert from "assert";

import type { Assert } from "../../main.test";

// Files cannot answer a patch request, so the build stops rather than ship a
// router whose every navigation loads its document twice.
const rejects: Assert = (_, block) =>
  assert.rejects(block, /static adapter cannot answer the patch requests/);

export const steps = [];
export const assert_dev = rejects;
export const assert_preview = rejects;

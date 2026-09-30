import assert from "assert";

import type { Assert } from "../../main.test";

// The @marko/vite this repo installs predates `patches`, so it ignores it.
const rejects: Assert = (_, block) =>
  assert.rejects(block, /`patches` option needs an @marko\/vite/);

export const steps = [];
export const assert_dev = rejects;
export const assert_preview = rejects;

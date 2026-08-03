import assert from "assert";

import type { Assert } from "../../main.test";

export const steps = [];

// `crawl` used to only `console.warn` an error status and resolve, so the vite
// build exited 0 with the page missing from `dist/public`. `/boom` answers 503
// and has to fail the build; `/quiet` answers 204, which is a success with
// nothing to prerender rather than a failure, and must not.
export const assert_preview: Assert = (_, blocks) =>
  assert.rejects(blocks, (error: Error) => {
    assert.match(error.message, /503 \/boom/);
    assert.doesNotMatch(error.message, /quiet/);
    return true;
  });

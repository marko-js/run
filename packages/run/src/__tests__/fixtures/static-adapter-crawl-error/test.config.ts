import assert from "assert";

import type { Assert } from "../../main.test";

export const steps = [];

// `crawl` used to only `console.warn` an error status and resolve, so the vite
// build exited 0 with the page missing from `dist/public`. `/boom` answers 503
// and has to fail the build; `/quiet` answers 204, which is a success with
// nothing to prerender rather than a failure, and must not. The summary of the
// crawl is logged either way, before the throw.
export const assert_preview: Assert = async (_, blocks) => {
  const logs: string[] = [];
  const { log } = console;
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" "));
    log(...args);
  };

  try {
    await assert.rejects(blocks, (error: Error) => {
      assert.match(error.message, /503 \/boom/);
      assert.doesNotMatch(error.message, /quiet/);
      return true;
    });
  } finally {
    console.log = log;
  }

  assert.equal(
    logs.find((entry) => entry.startsWith("Crawled")),
    "Crawled 3 paths: 2 successful, 0 redirects, 0 not found, 1 failure",
  );
};

import assert from "assert";

import type { Assert } from "../../main.test";

export const steps = [];

// `crawl` used to only `console.warn` an error status and resolve, so the vite
// build exited 0 with the page missing from `dist/public`. `/boom` answers 503
// and has to fail the build; `/quiet` answers 204, which is a success with
// nothing to prerender rather than a failure, and must not. Both statuses are
// unhandled, so both are listed under the summary the crawl logs before the
// throw. The output is colored when stdout is a tty, so the escapes are
// stripped before comparing.
export const assert_preview: Assert = async (_, blocks) => {
  const logs: string[] = [];
  const { log } = console;
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" ").replace(/\x1b\[\d+m/g, ""));
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
    "Crawled 3, success 2, failed 1, redirect 0, not found 0\n" +
      "/boom: 503\n" +
      "/quiet: 204",
  );
};

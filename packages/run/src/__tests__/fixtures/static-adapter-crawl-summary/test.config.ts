import assert from "assert";

import type { Assert } from "../../main.test";

export const steps = [];

// The crawl covers each bucket of the summary: `/` and `/other` render, `/away`
// answers a redirect, and `/gone` -- linked from the page but matching no route
// -- answers 404 without failing the build, listed under the counts with its
// status. The `/404` page the adapter seeds answers 404 by design, so it counts
// as a page that prerendered and stays out of the listing. The output is
// colored when stdout is a tty, so the escapes are stripped before comparing.
export const assert_preview: Assert = async (_, blocks) => {
  const logs: string[] = [];
  const { log } = console;
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" ").replace(/\x1b\[\d+m/g, ""));
    log(...args);
  };

  try {
    await blocks();
  } finally {
    console.log = log;
  }

  assert.equal(
    logs.find((entry) => entry.startsWith("Crawled")),
    "Crawled 5, success 3, failed 0, redirect 1, not found 1\n" +
      "/gone: 404",
  );
};

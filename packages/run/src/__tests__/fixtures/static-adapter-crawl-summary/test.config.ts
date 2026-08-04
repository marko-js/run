import assert from "assert";

import type { Assert } from "../../main.test";

export const steps = [];

// The crawl covers each bucket of the summary: `/` and `/other` render, `/away`
// answers a redirect, and `/gone` -- linked from the page but matching no route
// -- answers 404 without failing the build. The `/404` page the adapter seeds
// answers 404 by design, so it counts as a page that prerendered rather than as
// a path pointing nowhere.
export const assert_preview: Assert = async (_, blocks) => {
  const logs: string[] = [];
  const { log } = console;
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" "));
    log(...args);
  };

  try {
    await blocks();
  } finally {
    console.log = log;
  }

  assert.equal(
    logs.find((entry) => entry.startsWith("Crawled")),
    "Crawled 5 paths: 3 successful, 1 redirect, 1 not found, 0 failures\n" +
      "Paths that answered 404:\n" +
      "  /gone",
  );
};

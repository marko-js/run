import assert from "assert";
import fs from "fs";
import path from "path";

import type { Assert } from "../../main.test";

export const steps = [];

// `/other`, `/other/` and the `/other/` seed render the same page, so it is
// crawled and written once. Color escapes are stripped from the summary.
export const assert_preview: Assert = async (_, block) => {
  const logs: string[] = [];
  const { log } = console;
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" ").replace(/\x1b\[\d+m/g, ""));
    log(...args);
  };

  try {
    await block();
  } finally {
    console.log = log;
  }

  assert.equal(
    logs.find((entry) => entry.startsWith("Crawled")),
    "Crawled 2, success 2, failed 0, redirect 0, not found 0",
  );

  const files = fs.readdirSync(path.join(process.cwd(), "dist", "public"), {
    recursive: true,
  });
  assert.deepEqual(
    files
      .map((file) => String(file).replaceAll(path.sep, "/"))
      .filter((file) => file.endsWith(".html"))
      .sort(),
    ["index.html", "other.html"],
  );
};

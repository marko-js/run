import assert from "assert";
import fs from "fs";
import path from "path";

import type { Assert } from "../../main.test";

export const steps = [];

// `/other` and `/other/` render the same page, so it is written once.
export const assert_preview: Assert = async (_, block) => {
  await block();
  const files = fs.readdirSync(path.join(process.cwd(), "dist", "public"), {
    recursive: true,
  });
  assert.deepEqual(
    files
      .map((file) => String(file).replaceAll(path.sep, "/"))
      .filter((file) => file.endsWith(".html"))
      .sort(),
    ["index.html", "other/index.html"],
  );
};

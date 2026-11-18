import assert from "assert";
import fs from "fs";
import path from "path";

import type { Assert } from "../../main.test";

export const steps = [];

// Routes under `$` and `$$` are only written for the paths that link to them,
// never for the literal `/products/$` or `/docs/$$`.
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
    ["docs/guides/setup.html", "index.html", "products/lamp.html"],
  );
};

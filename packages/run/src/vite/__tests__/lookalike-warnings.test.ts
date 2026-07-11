import assert from "assert";

import { buildRoutes } from "../routes/builder";
import { createTestWalker } from "../routes/walk";
import { createDirectory } from "./utils/fakeFS";

async function collectWarnings(tree: string): Promise<string[]> {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    await buildRoutes(
      { walker: createTestWalker(createDirectory(tree, "/src/routes")) },
      "/dist/.marko-run",
    );
  } finally {
    console.warn = original;
  }
  return warnings;
}

describe("non-routable lookalike warnings", () => {
  it("names the convention a botched route file missed", async () => {
    const warnings = await collectWarnings(`
      +server.js
      +pge.marko
      $id.marko
    `);
    assert.match(
      warnings.find((w) => w.includes("+server.js"))!,
      /request handlers are named `\+handler\.<ext>`/,
    );
    assert.match(
      warnings.find((w) => w.includes("+pge.marko"))!,
      /routable files are `\+page\.marko`/,
    );
    assert.match(
      warnings.find((w) => w.includes("$id.marko"))!,
      /route files need a `\+type` suffix/,
    );
  });

  it("does not flag @ebay/arc variant files or bracket directories", async () => {
    // arc names adaptive variants `file[flag].ext` (flags combine with `+`) and
    // can bracket directories, so none of these may read as broken routes.
    const warnings = await collectWarnings(`
      +page.marko
      +page[mobile].marko
      header[mobile+android].js
      logo[ebay].svg
      /date-picker[experiment]
        +page.marko
    `);
    assert.deepEqual(warnings, []);
  });

  it("does not flag valid routes", async () => {
    const warnings = await collectWarnings(`
      +page.marko
      /products
        /$id
          +page.marko
    `);
    assert.deepEqual(warnings, []);
  });
});

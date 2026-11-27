import assert from "assert";
import type { ConfigEnv, UserConfig } from "vite";

import markoRun from "../plugin";

describe("dev css sourcemaps", () => {
  for (const viteVersion of ["8.4.0", "9.0.0"]) {
    it(`should enable them with dev.sourcemap.css on vite ${viteVersion}`, async () => {
      const config = await runConfigHook(viteVersion);

      assert.equal(config.css?.devSourcemap, undefined);
      assert.deepEqual(config.dev?.sourcemap, { css: true });
    });
  }

  it("should enable them with css.devSourcemap before vite 8.4", async () => {
    const config = await runConfigHook("8.3.8");

    assert.equal(config.css?.devSourcemap, true);
    assert.equal(config.dev?.sourcemap, undefined);
  });

  for (const sourcemap of [false, { css: false }]) {
    it(`should keep a dev.sourcemap of ${JSON.stringify(sourcemap)} from the project`, async () => {
      const config = await runConfigHook("8.4.0", { dev: { sourcemap } });

      assert.equal(config.css?.devSourcemap, undefined);
      assert.equal(config.dev?.sourcemap, undefined);
    });
  }
});

async function runConfigHook(viteVersion: string, userConfig: UserConfig = {}) {
  const plugin = markoRun({ adapter: null }).find(
    ({ name }) => name === "marko-run-vite:pre",
  )!;
  const config = plugin.config as (
    this: { meta: { viteVersion: string } },
    config: UserConfig,
    env: ConfigEnv,
  ) => Promise<UserConfig>;
  return config.call(
    { meta: { viteVersion } },
    { root: process.cwd(), logLevel: "silent", ...userConfig },
    { command: "serve", mode: "development" },
  );
}

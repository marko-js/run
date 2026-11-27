import assert from "assert";
import type { ConfigEnv, UserConfig } from "vite";

import markoRun from "../plugin";
import type { Adapter } from "../types";

type DevSourcemap = NonNullable<UserConfig["dev"]>["sourcemap"];

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

  it("should add css to a dev.sourcemap object from the adapter", async () => {
    const config = await runConfigHook("8.4.0", {}, adapterWith({ js: false }));

    assert.deepEqual(config.dev?.sourcemap, { js: false, css: true });
  });

  it("should keep a boolean dev.sourcemap from the adapter", async () => {
    const config = await runConfigHook("8.4.0", {}, adapterWith(false));

    assert.equal(config.dev?.sourcemap, false);
  });
});

function adapterWith(sourcemap: DevSourcemap): Adapter {
  return {
    name: "test-adapter",
    viteConfig: () => ({ dev: { sourcemap } }),
  };
}

async function runConfigHook(
  viteVersion: string,
  userConfig: UserConfig = {},
  adapter: Adapter | null = null,
) {
  const plugin = markoRun({ adapter }).find(
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

import type { Plugin } from "vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [requireNativeMagicString()],
  build: {
    rolldownOptions: {
      experimental: { nativeMagicString: true },
    },
  },
  server: {
    hmr: false,
  },
});

/**
 * Fails the build when a `Run.href` replacement comes back as a string instead
 * of Rolldown's native magic string, or when Rolldown does not see
 * `experimental.nativeMagicString`. The CLI adds `@marko/run`, so the plugin
 * and the build share one Vite even when the tests load Vite twice.
 */
function requireNativeMagicString(): Plugin {
  return {
    name: "test:require-native-magic-string",
    configResolved(config) {
      const plugin = config.plugins.find(
        (plugin) => plugin.name === "marko-run-vite:post",
      );
      if (!plugin) {
        return;
      }
      const transform = plugin.transform as (
        ...args: unknown[]
      ) => Promise<{ code?: unknown } | null | undefined>;
      plugin.transform = async function (...args: unknown[]) {
        const result = await transform.apply(this, args);
        if (typeof result?.code === "string") {
          throw new Error(`Expected a native magic string for ${args[1]}`);
        }
        return result;
      } as Plugin["transform"];
    },
    renderChunk(_code, _chunk, _options, meta) {
      if (!("magicString" in meta)) {
        throw new Error("Expected experimental.nativeMagicString to be on");
      }
    },
  };
}

import marko from "@marko/run/vite";
import { defineConfig, type Plugin } from "vite";

export default defineConfig({
  plugins: [asSeparateRolldownInstall(marko())],
  server: {
    hmr: false,
  },
});

/**
 * Builds as if Vite's rolldown were another install than any the plugins
 * import: a returned magic string is then not its class, so it keeps the
 * module's code unchanged. Only a string result applies regardless of copy.
 */
function asSeparateRolldownInstall(plugins: Plugin[]) {
  for (const plugin of plugins) {
    const hook = plugin.transform;
    if (!hook) continue;
    const handler = typeof hook === "function" ? hook : hook.handler;
    const transform: typeof handler = async function (code, id, options) {
      const result = await handler.call(this, code, id, options);
      return result &&
        typeof result === "object" &&
        result.code &&
        typeof result.code === "object"
        ? null
        : result;
    };
    plugin.transform =
      typeof hook === "function" ? transform : { ...hook, handler: transform };
  }
  return plugins;
}

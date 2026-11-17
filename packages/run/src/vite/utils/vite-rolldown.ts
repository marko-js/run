import { createRequire } from "module";
import { pathToFileURL } from "url";
import type { Rolldown } from "vite";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite/package.json"));

let viteRolldown: Promise<typeof Rolldown> | undefined;

/**
 * Loads the Rolldown copy that Vite depends on. A build only accepts a magic
 * string created by the Rolldown copy running it, which an app can install
 * alongside other copies.
 */
export function loadViteRolldown(): Promise<typeof Rolldown> {
  return (viteRolldown ??= import(
    pathToFileURL(viteRequire.resolve("rolldown")).href
  ));
}

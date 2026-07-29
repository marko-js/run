/**
 * Measurement-harness only. Forces artifact emission on/off for dual A/B
 * builds without a product Options/env surface.
 *
 * State lives on globalThis (Symbol.for) so a vite.config that calls the
 * setter and the plugin that reads it share one flag even if the module
 * graph is loaded twice. Not part of the public product API — do not use
 * in applications.
 */

const KEY = Symbol.for("@marko/run/artifact-emission-for-test");

/** When `false`, product builds behave as dual-entry (emission inactive). */
export function setArtifactEmissionForTest(enabled: boolean | undefined): void {
  const g = globalThis as Record<symbol, boolean | undefined>;
  if (enabled === undefined) delete g[KEY];
  else g[KEY] = enabled;
}

/** `undefined` = product default (emission follows `persisted`). */
export function getArtifactEmissionForTest(): boolean | undefined {
  return (globalThis as Record<symbol, boolean | undefined>)[KEY];
}

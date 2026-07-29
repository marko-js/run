/** Strip parent MARKO* env so suite-local protocol/debug overrides cannot
 *  leak into measured install/build/server children. Explicit `extra` keys
 *  are applied after the scrub (harness-only; not product dual knobs). */
export function cleanEnv(extra = {}) {
  const env = { ...process.env, NODE_OPTIONS: "" };
  for (const key of Object.keys(env)) {
    if (key.startsWith("MARKO")) delete env[key];
  }
  return { ...env, ...extra };
}

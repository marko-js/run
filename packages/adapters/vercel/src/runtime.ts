import { waitUntil as vercelWaitUntil } from "@vercel/functions";

import type { VercelPlatformInfo } from "./types";

/**
 * Creates the `platform` the adapter's own entry passes to Marko Run's router,
 * for a custom function entry: `fetch(request, createPlatform())`.
 */
export function createPlatform(): VercelPlatformInfo {
  return { waitUntil };
}

/**
 * Keeps the function running until `promise` settles, after the response has
 * been sent. Outside Vercel (dev, preview) the promise runs in the background.
 */
export function waitUntil(promise: Promise<unknown>): void {
  promise.catch((err) => console.error(err));
  vercelWaitUntil(promise);
}

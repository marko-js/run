import { fetch } from "@marko/run/router";
import type { Config, Context } from "@netlify/edge-functions";

import type { NetlifyEdgePlatformInfo } from "./types";

export default async function (request: Request, context: Context) {
  const response = await fetch<NetlifyEdgePlatformInfo>(request, context);
  if (response && response.status !== 404) {
    return response;
  }

  // Nothing was routed, so let the platform answer -- a published file lives
  // here, or nothing does and the app's own 404 page stands.
  const fallback = await context.next();
  return response && fallback.status === 404 ? response : fallback;
}

export const config: Config = {
  path: "/*",
};

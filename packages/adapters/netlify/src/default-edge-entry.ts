import { fetch } from "@marko/run/router";
import type { Context } from "@netlify/edge-functions";

import type { NetlifyEdgePlatformInfo } from "./types";

export default async function (request: Request, context: Context) {
  const response = await fetch<NetlifyEdgePlatformInfo>(request, {
    context,
  });
  return response || context.next();
}

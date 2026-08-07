import { fetch } from "@marko/run/router";
import type { Config, Context } from "@netlify/edge-functions";

import type { NetlifyEdgePlatformInfo } from "./types";

export default async function (request: Request, context: Context) {
  let fallback: Response | undefined;

  if (request.method === "GET" || request.method === "HEAD") {
    // The edge function runs before Netlify's static handling, so ask for
    // the static file first via next() — static files win over routes on
    // every other target.
    fallback = await context.next();
    if (fallback.status !== 404) {
      return fallback;
    }
  }

  return (
    (await fetch<NetlifyEdgePlatformInfo>(request, context)) ||
    fallback ||
    new Response(null, { status: 404 })
  );
}

export const config: Config = {
  path: "/*",
};

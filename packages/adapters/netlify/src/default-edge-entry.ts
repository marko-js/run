import { fetch } from "@marko/run/router";
import type { Config, Context } from "@netlify/edge-functions";

import type { NetlifyEdgePlatformInfo } from "./types";

export default async function (request: Request, context: Context) {
  // Race the platform's file lookup with the router when the path looks like
  // a file; otherwise ask only after the router has no better answer.
  const mayBeStatic = request.method === "GET" || request.method === "HEAD";
  const [response, eagerFallback] = await Promise.all([
    fetch<NetlifyEdgePlatformInfo>(request, context),
    mayBeStatic && new URL(request.url).pathname.includes(".")
      ? context.next()
      : undefined,
  ]);

  const fallback =
    eagerFallback ||
    (!response || (mayBeStatic && response.status === 404)
      ? await context.next()
      : undefined);

  // A published file wins over the app, as it does on every other target.
  if (fallback && fallback.status !== 404) {
    return fallback;
  }

  return response || fallback || new Response(null, { status: 404 });
}

export const config: Config = {
  path: "/*",
};

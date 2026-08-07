import { fetch } from "@marko/run/router";
import type { Config, Context } from "@netlify/edge-functions";

import type { NetlifyEdgePlatformInfo } from "./types";

export default async function (request: Request, context: Context) {
  // Only a request the platform could answer with a file gets a `next()`, and
  // only up front when the path looks like one -- that lookup races the
  // router, so it costs no latency. Everything else asks only once the router
  // has passed, which keeps the common route request down to a single pass.
  const mayBeStatic = request.method === "GET" || request.method === "HEAD";
  const [response, eagerFallback] = await Promise.all([
    fetch<NetlifyEdgePlatformInfo>(request, context),
    mayBeStatic && new URL(request.url).pathname.includes(".")
      ? context.next()
      : undefined,
  ]);

  const fallback =
    eagerFallback ||
    (mayBeStatic && (!response || response.status === 404)
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

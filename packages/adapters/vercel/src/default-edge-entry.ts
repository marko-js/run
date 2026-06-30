import { fetch } from "@marko/run/router";

import type { VercelEdgePlatformInfo } from "./types";

export default async function (
  request: Request,
  context: VercelEdgePlatformInfo,
) {
  return (
    (await fetch<VercelEdgePlatformInfo>(request, context)) ||
    new Response(null, { status: 404 })
  );
}

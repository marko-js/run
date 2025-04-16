import { fetch } from "@marko/run/router";
import type { Config, Context } from "@netlify/edge-functions";

import type { NetlifyEdgePlatformInfo } from "./types";

export default async function (request: Request, context: Context) {
  return (
    (await fetch<NetlifyEdgePlatformInfo>(request, context)) || context.next()
  );
}

export const config: Config = {
  pattern: "^[^.]*$",
};

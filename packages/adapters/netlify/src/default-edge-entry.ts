import { fetch } from "@marko/run/router";
import type { Config, Context } from "@netlify/edge-functions";
import declaration from "virtual:marko-run-adapter-netlify/routes";

import type { NetlifyEdgePlatformInfo } from "./types";

export default async function (request: Request, context: Context) {
  return (
    (await fetch<NetlifyEdgePlatformInfo>(request, context)) || context.next()
  );
}

// Declaring the app's routes leaves every other path -- published files
// included -- to Netlify's own static handling.
export const config: Config = declaration;

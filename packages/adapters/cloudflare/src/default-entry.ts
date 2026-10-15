import type {
  ExecutionContext,
  Fetcher,
  Request as CfRequest,
} from "@cloudflare/workers-types";
import { fetch } from "@marko/run/router";

import { heldOpen } from "./runtime";
import type { CloudflarePlatformInfo } from "./types";

export default {
  async fetch(
    request: CfRequest,
    env: { ASSETS?: Fetcher },
    ctx: ExecutionContext,
  ) {
    const response = await fetch<CloudflarePlatformInfo>(request as any, {
      env,
      ctx,
      cf: request.cf,
    });

    if (response) {
      return heldOpen(response, ctx);
    }

    // Fall back to the static asset handler when no route matched. This is a
    // safety net — Cloudflare normally serves matching assets before invoking
    // the worker.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(null, { status: 404 });
  },
};

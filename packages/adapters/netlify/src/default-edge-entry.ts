import { router } from "@marko/run/router";
import type { Context } from "@netlify/edge-functions";
import type { NetlifyEdgePlatformInfo } from './types';

export default async function (request: Request, context: Context) {
  const response = await router<NetlifyEdgePlatformInfo>({
    request,
    method: request.method,
    url: new URL(request.url),
    platform: {
      context
    }
  });

  response?.headers.delete('content-length');

  return response || context.next();
}

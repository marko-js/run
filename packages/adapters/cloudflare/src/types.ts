import type {
  ExecutionContext,
  Fetcher,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";

/**
 * The bindings available to the worker. The `ASSETS` binding is provided
 * automatically by Cloudflare Pages and by Workers configured with a static
 * assets directory, and is used to serve the app's static files.
 */
export interface CloudflareEnv {
  ASSETS: Fetcher;
  [key: string]: unknown;
}

/**
 * The platform object passed to Marko Run route handlers when deployed to
 * Cloudflare. Exposes the Worker's environment bindings, the execution
 * context (for `waitUntil`/`passThroughOnException`) and the Cloudflare
 * request properties (`request.cf`).
 */
export interface CloudflarePlatformInfo<Env = CloudflareEnv> {
  env: Env;
  ctx: ExecutionContext;
  cf?: IncomingRequestCfProperties;
}

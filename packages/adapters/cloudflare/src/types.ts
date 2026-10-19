import type {
  ExecutionContext,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";

/**
 * The Worker's bindings, as the app's Wrangler config declares them. Empty
 * here: the app adds its own by augmenting this interface, typed with
 * whichever `@cloudflare/workers-types` it uses.
 */
export interface CloudflareEnv {}

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

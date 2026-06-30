import type { NodePlatformInfo } from "@marko/run/adapter";

/**
 * The platform object passed to Marko Run route handlers when deployed as a
 * Vercel Edge Function. Matches the Edge runtime's request context.
 */
export interface VercelEdgePlatformInfo {
  /**
   * Extend the lifetime of the function until the given promise settles,
   * without blocking the response.
   */
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * The platform object passed to Marko Run route handlers when deployed as a
 * Vercel (Node.js) Serverless Function. Exposes the underlying Node request
 * and response objects.
 */
export interface VercelNodePlatformInfo extends NodePlatformInfo {}

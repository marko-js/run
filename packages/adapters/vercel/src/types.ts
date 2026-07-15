import type { NodePlatformInfo } from "@marko/run/adapter";

/**
 * The platform object passed to Marko Run route handlers when deployed as a
 * Vercel (Node.js) Serverless Function. Exposes the underlying Node request
 * and response objects.
 */
export interface VercelNodePlatformInfo extends NodePlatformInfo {}

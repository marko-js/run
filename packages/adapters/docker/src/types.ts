import type { NodePlatformInfo } from "@marko/run/adapter";

/**
 * The platform object passed to Marko Run route handlers when running the
 * containerized Node.js server. Exposes the underlying Node request and
 * response objects.
 */
export interface DockerPlatformInfo extends NodePlatformInfo {}

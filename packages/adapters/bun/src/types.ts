/**
 * The platform object passed to Marko Run route handlers when running on Bun.
 * It is the `Bun.serve` server instance, which exposes per-request helpers
 * such as `requestIP`.
 */
export interface BunPlatformInfo {
  /** The address of the client that made the request, if available. */
  requestIP(request: Request): {
    address: string;
    family: string;
    port: number;
  } | null;
  /** The port the server is listening on. */
  readonly port: number;
  /** The hostname the server is listening on. */
  readonly hostname: string;
}

/**
 * The platform object passed to Marko Run route handlers when deployed to
 * Deno or Deno Deploy. Matches the info object Deno passes as the second
 * argument to a `Deno.serve` handler.
 */
export interface DenoPlatformInfo {
  /** The network address of the client that made the request. */
  remoteAddr: {
    transport: "tcp" | "udp";
    hostname: string;
    port: number;
  };
  /** Resolves once the request has been fully handled. */
  completed: Promise<void>;
}

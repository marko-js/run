/**
 * The platform object passed to Marko Run route handlers when deployed as a
 * Vercel Function.
 */
export interface VercelPlatformInfo {
  /**
   * Keeps the function running until `promise` settles, after the response
   * has been sent. Use it for work the response doesn't wait on, such as
   * analytics, logging or cache writes.
   */
  waitUntil(promise: Promise<unknown>): void;
}

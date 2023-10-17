import type { ViteDevServer } from "vite";
import type { NodeMiddleware } from "./middleware";

declare global {
  var __marko_run_middleware__:
    | ((factory: () => NodeMiddleware) => () => NodeMiddleware)
    | undefined;
}

export default globalThis.__marko_run_middleware__ ??= (() => {
  if (process.env.NODE_ENV !== "production") {
    const devServerPromise: Promise<ViteDevServer> = (async () => {
      const { createViteDevServer } = await import("@marko/run/adapter");
      return createViteDevServer(globalThis.__marko_run_vite_config__);
    })();

    return (factory) => () => {
      // Create the middleware defined by the user
      const originalMiddleware = factory();

      // An async node middleware function which when called by the server during a request for the first time:
      //   1. Waits for the dev server singleton to be created and then creates a new middleware using the dev
      //      server which loads `@marko/run/router` for all requests. This is necessary to ensure the latest
      //      code is used after a hot-replacement.
      //   2. Replaces itself with the new middleware for susequent requests
      //   3. Calles the new middleware
      let middleware: NodeMiddleware = async (req, res, next) => {
        const devServer = await devServerPromise!;
        middleware = devServer.middlewares.use(async (req, res, next) => {
          await devServer.ssrLoadModule("@marko/run/router");
          originalMiddleware(req, res, next);
        });
        middleware(req, res, next);
      };

      // Wrap the middleware described above so it can be swapped out after the first request.
      return (req, res, next) => middleware(req, res, next);
    };
  }
  return (factory) => factory;
})();

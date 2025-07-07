import "@marko/run/router";

import type { IncomingMessage } from "http";
import type { Connect, ViteDevServer } from "vite";

import type { NodeMiddleware } from "./middleware";

declare global {
  var __marko_run_middleware__:
    | (<T extends any[]>(
        factory: (...args: T) => NodeMiddleware,
      ) => (...args: T) => NodeMiddleware)
    | undefined;
}

export default globalThis.__marko_run_middleware__ ??=
  process.env.NODE_ENV && process.env.NODE_ENV !== "development"
    ? (factory) => factory
    : (() => {
        let devServer: ViteDevServer;
        let errorMiddleware: Connect.ErrorHandleFunction | undefined;
        let devMiddleware: NodeMiddleware = async (req, res, next) => {
          await initPromise;
          devMiddleware(req, res, next);
        };

        const seenReqs = new WeakSet<IncomingMessage>();
        const initPromise = (async () => {
          const adapter = await import("@marko/run/adapter");
          devServer = await adapter.createViteDevServer(
            globalThis.__marko_run_vite_config__,
          );

          await devServer.ssrLoadModule("@marko/run/router");

          errorMiddleware = adapter.createErrorMiddleware(devServer);
          devMiddleware = (req, res, next) => {
            if (seenReqs.has(req)) {
              return next?.();
            }
            seenReqs.add(req);
            devServer.middlewares(req, res, next);
          };
        })();

        return (factory) =>
          (...args) => {
            // Create the middleware defined by the user
            const middleware = factory(...args);

            return (req, res, next) => {
              const handleError = (err: Error | undefined) => {
                if (err) {
                  errorMiddleware!(err, req, res, next!);
                  return;
                }
                next?.();
              };

              devMiddleware(req, res, async (err) => {
                if (err) {
                  handleError(err);
                  return;
                }

                try {
                  await devServer.ssrLoadModule("@marko/run/router");
                } catch (err) {
                  handleError(err as Error);
                  return;
                }

                middleware(req, res, handleError);
              });
            };
          };
      })();

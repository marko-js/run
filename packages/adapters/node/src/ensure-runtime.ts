import type { Connect, ViteDevServer } from "vite";
import type { IncomingMessage } from "http";
import type { NodeMiddleware } from "./middleware";

declare global {
  var __marko_run_middleware__:
    | (<T extends any[]>(
        factory: (...args: T) => NodeMiddleware
      ) => (...args: T) => NodeMiddleware)
    | undefined;
}

export default globalThis.__marko_run_middleware__ ??=
  process.env.NODE_ENV === "production"
    ? (factory) => factory
    : (() => {
        let devServer: ViteDevServer | undefined;
        let errorMiddleware: Connect.ErrorHandleFunction | undefined;

        const seenReqs = new WeakSet<IncomingMessage>();
        const devServerPromise = import("@marko/run/adapter").then(
          async (mod) => {
            devServer = await mod.createViteDevServer(
              globalThis.__marko_run_vite_config__
            );
            errorMiddleware = mod.createErrorMiddleware(devServer);
            
            void devServer!.ssrLoadModule("@marko/run/router").catch(() => {});
            devMiddleware = (req, res, next) => {
              if (seenReqs.has(req)) {
                return next?.();
              }
              seenReqs.add(req);
              devServer!.middlewares(req, res, next);
            };
          }
        );

        let devMiddleware: NodeMiddleware = async (req, res, next) => {
          await devServerPromise;
          devMiddleware(req, res, next);
        };

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
              }

              devMiddleware(req, res, async (err) => {
                if (err) {
                  handleError(err)
                  return;
                }

                try {
                  await devServer!.ssrLoadModule("@marko/run/router");
                } catch (err) {
                  handleError(err as Error)
                  return;
                }

                middleware(req, res, handleError);
              });
            };
          };
      })();

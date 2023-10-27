import { inspect } from "util";
import type { ViteDevServer } from "vite";
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

        const seenReqs = new WeakSet<IncomingMessage>();
        const devServerPromise = import("@marko/run/adapter").then(
          async (mod) => {
            devServer = await mod.createViteDevServer(
              globalThis.__marko_run_vite_config__
            );
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
              function handleNext(err: unknown) {
                if (err) {
                  if (err instanceof Error) {
                    devServer!.ssrFixStacktrace(err);
                  }

                  console.error(err);

                  if (res.headersSent) {
                    if (!res.destroyed) {
                      (res.socket as any)?.destroySoon();
                    }
                  } else {
                    res.statusCode = 500;
                    res.end(inspect(err).replace(/([\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g, ""));
                  }
                } else {
                  next?.();
                }
              }

              devMiddleware(req, res, async (err) => {
                if (err) {
                  handleNext(err);
                  return;
                }

                try {
                  await devServer!.ssrLoadModule("@marko/run/router");
                } catch (err) {
                  handleNext(err);
                  return;
                }

                middleware(req, res, handleNext);
              });
            };
          };
      })();

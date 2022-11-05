import type { ServerOptions as ViteServerOptions } from "vite";
import { createAsyncMiddleware } from "./utils";

export interface Options extends ViteServerOptions {

}

export default function routingMiddleware(options: Options = {}) {
  return createAsyncMiddleware('RoutinghMW', async () => {
    if (process.env.NODE_ENV !== "production") {
      const { createServer } = await import("vite");
      const devServer = await createServer({
        appType: "custom",
        server: {
          ...options,
          middlewareMode: true
        },
      });

      return devServer.middlewares.use(async (_req, _res, next) => {
        console.log(`RoutinghMW: importing @marko/serve via ssrLoadModule`);
        await devServer.ssrLoadModule("@marko/serve");
        console.log(`RoutinghMW: import complete`);
        next();
      });
    }

    await import("@marko/serve");
  });
}

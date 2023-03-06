import { createServer, ViteDevServer } from "vite";
import type { RuntimeModule } from "../runtime";
import type { NodeMiddleware } from "./middleware";

export function createViteDevMiddleware<T>(
  devServer: ViteDevServer,
  load: (prev: T | undefined) => Promise<T>,
  factory: (value: T) => NodeMiddleware
): NodeMiddleware {
  let value: T | undefined;
  let middleware: NodeMiddleware;

  return async (req, res, next) => {
    try {
      const nextValue = await load(value);
      if (nextValue !== value) {
        value = nextValue;
        middleware = factory(value);
      }
      await middleware(req, res, next);
    } catch (err) {
      res.statusCode = 500;
      if (err instanceof Error) {
        devServer.ssrFixStacktrace(err);
        res.end(err.stack);
      } else {
        res.end();
      }
    }
  };
}

export async function createDevServer(configFile?: string) {
  const devServer = await createServer({
    configFile,
    appType: "custom",
    server: { middlewareMode: true },
    resolve: {
      dedupe: ["marko"],
      conditions: ["worker"],
    },
  });
  const { createMiddleware } = await devServer.ssrLoadModule(
    "@marko/run/adapter/middleware"
  );
  const middleware = createViteDevMiddleware(
    devServer,
    async () =>
      (await devServer.ssrLoadModule("@marko/run/router")) as RuntimeModule,
    (module) => createMiddleware(module.fetch, { devServer })
  );
  return devServer.middlewares.use(middleware);
}

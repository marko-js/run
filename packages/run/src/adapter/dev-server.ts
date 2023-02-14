import { createServer, ViteDevServer } from "vite";
import createMiddleware, { type NodeMiddleware } from "./middleware";

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
      if (err instanceof Error) {
        devServer.ssrFixStacktrace(err);
      }
      return next?.();
    }
  };
}

export async function createDevServer(configFile?: string) {
  const devServer = await createServer({
    configFile,
    appType: "custom",
    server: { middlewareMode: true },
  });
  const middleware = createViteDevMiddleware(
    devServer,
    async () => (await devServer.ssrLoadModule("@marko/run/router")).router,
    createMiddleware
  );
  return devServer.middlewares.use(middleware);
}

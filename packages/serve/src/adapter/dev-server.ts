import { createServer, ViteDevServer } from "vite";
import { createMiddleware, type NodeMiddleware } from "@hattip/adapter-node";
import type { Server } from "http";

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

export async function createDevServer(configFile: string): Promise<Server> {
  const devServer = await createServer({
    configFile,
    appType: "custom",
    server: { middlewareMode: true },
  });
  const middleware = createViteDevMiddleware(
    devServer,
    async () => (await devServer.ssrLoadModule("@marko/serve")).handler,
    createMiddleware
  );
  return devServer.middlewares.use(middleware) as unknown as Server;
}

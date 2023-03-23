import { createServer, type InlineConfig, type ViteDevServer } from "vite";
import type { RuntimeModule } from "../runtime";
import type { NodeMiddleware } from "./middleware";
import stripAnsi from 'strip-ansi';

export const activeDevServers = new Set<ViteDevServer>();

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
        res.end(err.stack && stripAnsi(err.stack));
      } else {
        res.end();
      }
    }
  };
}

export async function createViteDevServer(config?: InlineConfig): Promise<ViteDevServer> {
  const devServer = await createServer({
    ...config,
    appType: "custom",
    server: { middlewareMode: true }
  });

  const originalClose = devServer.close;
  devServer.close = () => {
    activeDevServers.delete(devServer);
    return originalClose.call(devServer);
  }

  activeDevServers.add(devServer);
  return devServer;
}


export async function createDevServer(config?: InlineConfig): Promise<ViteDevServer> {
  const devServer = await createViteDevServer(config);

  const { createMiddleware } = await devServer.ssrLoadModule(
    "@marko/run/adapter/middleware"
  );

  const middleware = createViteDevMiddleware(
    devServer,
    async () =>
      (await devServer.ssrLoadModule("@marko/run/router")) as RuntimeModule,
    (module) => createMiddleware(module.fetch, { devServer })
  );
  devServer.middlewares.use(middleware);
  return devServer;
}

import baseAdapter, {
  type Adapter,
  closeServer,
  createErrorMiddleware,
  createViteDevServer,
} from "@marko/run/adapter";
import { createMiddleware } from "@marko/run/adapter/middleware";
import type { Server } from "http";
import type { AddressInfo } from "net";
import path from "path";

export default (): Adapter => {
  return {
    ...baseAdapter(),
    name: "custom-adapter",
    getEntryFile() {
      return path.join(process.cwd(), "src", "worker.ts");
    },
    async startDev({ entry, config, options }) {
      const devServer = await createViteDevServer(config);
      // Stands in for a worker's own runtime, where only the entry loads the router.
      delete (globalThis as any).__marko_run__;
      devServer.middlewares
        .use(
          createMiddleware(async (request, platform) => {
            const worker = await devServer.ssrLoadModule(entry!);
            return worker.default.fetch(request, platform);
          }),
        )
        .use(createErrorMiddleware(devServer));

      const listener = await new Promise<Server>((resolve) => {
        const server = devServer.middlewares.listen(options.port, () =>
          resolve(server),
        );
      });
      return {
        port: (listener.address() as AddressInfo).port,
        async close() {
          await Promise.allSettled([devServer.close(), closeServer(listener)]);
        },
      };
    },
  };
};

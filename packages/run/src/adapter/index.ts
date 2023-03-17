import path from "path";
import { fileURLToPath } from "url";
import type { Adapter } from "../vite";
import { createDevServer } from "./dev-server";
import type { AddressInfo } from "net";
import { loadEnv, spawnServer, type SpawnedServer } from "../vite/utils/server";
export { createDevServer, createViteDevMiddleware } from "./dev-server";
export type { Adapter, SpawnedServer };
export type { NodePlatformInfo } from "./middleware";

// @ts-expect-error
import parseNodeArgs from "parse-node-args";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default function adapter(): Adapter {
  return {
    name: "base-adapter",

    async getEntryFile() {
      const entry = path.join(__dirname, "default-entry");
      return entry;
    },

    async startDev(config, { port = 3000, envFile }) {
      const { root, configFile } = config;
      envFile && (await loadEnv(envFile));

      const devServer = await createDevServer({
        root,
        configFile,
      });

      return new Promise<SpawnedServer>((resolve) => {
        const listener = devServer.middlewares.listen(port, () => {
          const address = listener.address() as AddressInfo;
          console.log(`Dev server started: http://localhost:${address.port}`);
          resolve({
            port,
            async close() {
              await devServer.close();
            },
          });
        });
      });
    },

    async startPreview(entry, options) {
      const { port, envFile } = options;
      const { nodeArgs } = parseNodeArgs(options.args);
      const args = [...nodeArgs, entry]
      const server = await spawnServer('node', args, port, envFile);
      console.log(`Preview server started: http://localhost:${server.port}`);
      return server;
    },
  };
}

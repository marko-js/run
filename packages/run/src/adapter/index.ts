import path from "path";
import { fileURLToPath } from "url";
import type { Worker } from "cluster";
import type { Adapter } from "../vite";
import { createDevServer, type MarkoRunDev } from "./dev-server";
import type { AddressInfo } from "net";
import {
  loadEnv,
  spawnServer,
  spawnServerWorker,
  waitForWorker,
  type SpawnedServer,
} from "../vite/utils/server";

export {
  getDevGlobal,
  createDevServer,
  createViteDevServer,
  createViteDevMiddleware,
  type MarkoRunDev
} from "./dev-server";
export type { Adapter, SpawnedServer };
export type { NodePlatformInfo } from "./middleware";

export type MarkoRunDevAccessor = () => MarkoRunDev

// @ts-expect-error
import parseNodeArgs from "parse-node-args";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultEntry = path.join(__dirname, "default-entry");
const loadDevWorker = path.join(__dirname, "load-dev-worker.mjs");

export default function adapter(): Adapter {
  return {
    name: "base-adapter",

    async getEntryFile() {
      return defaultEntry;
    },

    async startDev(entry, config, options) {
      const { port = 3000, envFile } = options;

      if (entry) {
        const { nodeArgs } = parseNodeArgs(options.args);
        let worker: Worker;

        async function start() {
          const nextWorker = await spawnServerWorker(
            loadDevWorker,
            nodeArgs,
            port,
            envFile
          );

          nextWorker
            .on("message", (messsage) => {
              if (messsage === "restart") {
                start();
              }
            })
            .send({ type: "start", entry, config });

          await waitForWorker(nextWorker, port);

          if (worker) {
            const prevWorker = worker;
            let timeout: any;
            worker.once("disconnect", () => {
              clearTimeout(timeout);
            });
            worker.send({ type: "shutdown" });
            worker.disconnect();
            timeout = setTimeout(() => {
              prevWorker.kill();
            }, 2000);
          }

          worker = nextWorker;
        }

        await start();

        return {
          port,
          close() {
            worker.kill();
          },
        };
      }

      const devServer = await createDevServer(config);
      envFile && (await loadEnv(envFile));

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
      const { port = 3000, envFile } = options;
      const { nodeArgs } = parseNodeArgs(options.args);
      const args = [...nodeArgs, entry];
      const server = await spawnServer("node", args, port, envFile);
      console.log(`Preview server started: http://localhost:${server.port}`);
      return server;
    },
  };
}



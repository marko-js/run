import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { Worker } from "cluster";
import type { Adapter, ExplorerData } from "../vite";
import { createDevServer, type MarkoRunDev } from "./dev-server";
import { logInfoBox } from "./utils";
import type { AddressInfo } from "net";
import {
  loadEnv,
  spawnServer,
  spawnServerWorker,
  waitForWorker,
  type SpawnedServer,
} from "../vite/utils/server";
import { createRequire } from "module";

export {
  getDevGlobal,
  createDevServer,
  createViteDevServer,
  type MarkoRunDev,
} from "./dev-server";
export type { Adapter, SpawnedServer };
export type { NodePlatformInfo } from "./middleware";

export type MarkoRunDevAccessor = () => MarkoRunDev;

// @ts-expect-error
import parseNodeArgs from "parse-node-args";
import { markoRunFilePrefix, virtualFilePrefix } from "../vite/constants";

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

      globalThis.__marko_run_vite_config__ = config;

      const explorerPromise = startExplorer();

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

        const [explorer] = await Promise.all([explorerPromise, start()]);

        return {
          port,
          async close() {
            await Promise.all([worker.kill(), explorer?.close()]);
          },
        };
      }

      const devServer = await createDevServer(config);
      envFile && (await loadEnv(envFile));

      const listen = new Promise<AddressInfo>((resolve) => {
        const listener = devServer.middlewares.listen(port, () => {
          resolve(listener.address() as AddressInfo);
        });
      });

      const [explorer, address] = await Promise.all([explorerPromise, listen]);

      logInfoBox(
        `http://localhost:${address.port}`,
        explorer && `http://localhost:${explorer.port}`
      );

      return {
        port: address.port,
        async close() {
          await Promise.all([devServer.close(), explorer?.close()]);
        },
      };
    },

    async startPreview(entry, options) {
      const { port = 3000, envFile } = options;
      const { nodeArgs } = parseNodeArgs(options.args);
      const args = [...nodeArgs, entry];

      const [explorer, server] = await Promise.all([
        startExplorer(),
        spawnServer("node", args, port, envFile),
      ]);

      if (!options.sourceEntry) {
        logInfoBox(
          `http://localhost:${port}`,
          explorer && `http://localhost:${explorer.port}`
        );
      }
      return explorer
        ? {
            port: server.port,
            async close() {
              await Promise.all([server.close(), explorer.close()]);
            },
          }
        : server;
    },

    async routesGenerated(routes, virtualFiles, meta) {
      if (process.env.MR_EXPLORER !== "true") {
        return;
      }

      const promises: Promise<any>[] = [];
      const cacheDir = path.resolve(__dirname, "../../.cache/explorer");
      const codeDir = path.join(cacheDir, "code");

      if (fs.existsSync(codeDir)) {
        await fs.promises.rm(codeDir, { recursive: true });
      }
      await fs.promises.mkdir(codeDir, { recursive: true });

      const data: ExplorerData = {
        meta,
        routes: {},
        files: {},
      };

      for (const [name, code] of virtualFiles) {
        let fileName = "";
        let index = name.indexOf(markoRunFilePrefix);
        if (index >= 0) {
          fileName = name.slice(index);
          data.files[fileName] = `${virtualFilePrefix}/${fileName}`;
        } else if (name.startsWith("@marko/run")) {
          fileName = name.slice(11);
          data.files[fileName] = name;
        }
        if (fileName) {
          promises.push(
            fs.promises.writeFile(path.join(codeDir, fileName), code, {})
          );
        }
      }

      for (const route of routes.list) {
        data.routes[route.index] = route;
      }

      for (const [id, route] of Object.entries(routes.special)) {
        data.routes["s" + id] = route;
      }

      promises.push(
        fs.promises.writeFile(
          path.join(cacheDir, "data.json"),
          JSON.stringify(data),
          {}
        )
      );

      await Promise.all(promises);
    },
  };
}

const require = createRequire(import.meta.url);
async function startExplorer() {
  if (process.env.MR_EXPLORER === "true") {
    const entry = require.resolve("@marko/run-explorer");
    const worker = await spawnServerWorker(entry, [], 1234, undefined, false);
    return {
      port: 1234,
      async close (){
        worker.kill();
      }
    }
  }
}

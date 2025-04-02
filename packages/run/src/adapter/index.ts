import type { Worker } from "cluster";
import fs from "fs";
import inspector from "inspector";
import type { AddressInfo } from "net";
import path from "path";
import { fileURLToPath } from "url";

import type { Adapter, ExplorerData } from "../vite";
import {
  getAvailablePort,
  getInspectOptions,
  loadEnv,
  type SpawnedServer,
  spawnServer,
  spawnServerWorker,
  waitForWorker,
} from "../vite/utils/server";
import { createDevServer, type MarkoRunDev } from "./dev-server";
import { logInfoBox } from "./utils";

export {
  createDevServer,
  createErrorMiddleware,
  createViteDevServer,
  getDevGlobal,
  type MarkoRunDev,
} from "./dev-server";
export type { Adapter, SpawnedServer };
export type { NodePlatformInfo } from "./middleware";

export type MarkoRunDevAccessor = () => MarkoRunDev;

import { Server } from "http";
// @ts-expect-error - no types 🥲
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

      if (entry && entry !== defaultEntry) {
        const { nodeArgs } = parseNodeArgs(options.args);
        let worker: Worker;

        async function start() {
          const nextWorker = await spawnServerWorker(
            loadDevWorker,
            nodeArgs,
            port,
            envFile,
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
            worker.once("disconnect", () => {
              clearTimeout(timeout);
            });
            worker.send({ type: "shutdown" });
            worker.disconnect();
            const timeout = setTimeout(() => {
              prevWorker.kill();
            }, 2000);
          }

          worker = nextWorker;
        }

        const [explorer] = await Promise.all([explorerPromise, start()]);

        return {
          port,
          async close() {
            await Promise.allSettled([worker.kill(), explorer?.close()]);
          },
        };
      }

      const devServer = await createDevServer(config);
      envFile && (await loadEnv(envFile));

      const inspect = getInspectOptions(options.args);
      if (inspect) {
        inspector.open(inspect.port, inspect.host, inspect.wait);
      }

      const listenerPromise = new Promise<Server>((resolve) => {
        const listener = devServer.middlewares.listen(port, () => {
          resolve(listener);
        });
      });

      const [explorer, listener] = await Promise.all([
        explorerPromise,
        listenerPromise,
      ]);
      const address = listener.address() as AddressInfo;

      logInfoBox(
        `http://localhost:${address.port}`,
        explorer && `http://localhost:${explorer.port}`,
      );

      return {
        port: address.port,
        async close() {
          await Promise.allSettled([
            devServer.close(),
            listener.close(),
            explorer?.close(),
          ]);
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

      if (options.entry === defaultEntry) {
        logInfoBox(
          `http://localhost:${port}`,
          explorer && `http://localhost:${explorer.port}`,
        );
      }
      return explorer
        ? {
            port: server.port,
            async close() {
              await Promise.allSettled([server.close(), explorer.close()]);
            },
          }
        : server;
    },

    async routesGenerated(routes, virtualFiles, meta) {
      if (process.env.MR_EXPLORER === "false") {
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
        const index = name.indexOf(markoRunFilePrefix);
        if (index >= 0) {
          fileName = name.slice(index);
          data.files[fileName] = `${virtualFilePrefix}/${fileName}`;
        } else if (name.startsWith("@marko/run")) {
          fileName = name.slice(11);
          data.files[fileName] = name;
        }
        if (fileName) {
          promises.push(
            fs.promises.writeFile(path.join(codeDir, fileName), code, {}),
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
          {},
        ),
      );

      await Promise.all(promises);
    },
  };
}

async function startExplorer() {
  if (process.env.MR_EXPLORER !== "false") {
    const port = await getAvailablePort(1234);
    const { start } = await import("@marko/run-explorer");

    return start(port);
  }
}

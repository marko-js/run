import path from "path";
import { fileURLToPath } from "url";
import type { Adapter } from "../vite";
import { createDevServer } from "./dev-server";
import type { AddressInfo } from "net";
import { loadEnv, spawnServer } from "../vite/utils/server";

export { createDevServer, createViteDevMiddleware } from "./dev-server";
export type { Adapter };
export type { NodePlatformInfo } from './middleware';

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default function adapter(): Adapter {
  return {
    name: "base-adapter",

    async getEntryFile() {
      const entry = path.join(__dirname, "default-entry");
      return entry;
    },

    async startDev(configFile, port, envFile) {
      envFile && await loadEnv(envFile);
      const server = await createDevServer(configFile);
      
      return new Promise((resolve) => {
        const listener = server.listen(port, () => {
          const address = listener.address() as AddressInfo;
          console.log(`Dev server started: http://localhost:${address.port}`);
          resolve();
        });
      });
    },

    async startPreview(_dir, entry, port, envFile) {
      const server = await spawnServer(`node ${entry}`, port, envFile);
      console.log(`Preview server started: http://localhost:${server.port}`);
    },
  };
}

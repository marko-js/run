import path from "path";
import { fileURLToPath } from "url";
import type { Adapter } from "../vite";

import { createDevServer } from "./dev-server";
import type { AddressInfo } from "net";
import { spawnServer } from "../vite/utils/server";

export { createDevServer, createViteDevMiddleware } from "./dev-server";

export type { Adapter };

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default function adapter(): Adapter {
  return {
    name: "base-adapter",

    async getEntryFile() {
      
      const entry = path.join(__dirname, "default-entry");
      return entry;
    },

    async startDev(configFile, port) {
      const server = await createDevServer(configFile);
      server.on("error", (err) => {
        console.error(err);

        // Don't crash the server and exit
        process.exit(1);
      });

      return new Promise((resolve) => {
        const listener = server.listen(port, () => {
          const address = listener.address() as AddressInfo;
          console.log(`Dev server started: http://localhost:${address.port}`);
          resolve();
        });
      });
    },

    async startPreview(dir, entry, cmd, port) {
      const server = await spawnServer(cmd || `node ${entry}`, port, dir);
      console.log(`Preview server started: http://localhost:${server.port}`);
    },
  };
}

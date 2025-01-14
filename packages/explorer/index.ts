// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore-next-line - Errors during build due to missing types?
import { spawnServerWorker } from "@marko/run/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const entry = path.join(__dirname, "server.js");

export async function start(port: number) {
  const worker = await spawnServerWorker(entry, [], port, undefined, false);
  return {
    port,
    async close() {
      worker.kill();
    },
  };
}

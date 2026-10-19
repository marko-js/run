import assert from "assert";
import fs from "fs";
import type { ServerResponse } from "http";
import os from "os";
import path from "path";
import type { ViteDevServer } from "vite";

import { createViteDevServer, getDevGlobal } from "../adapter/dev-server";

describe("dev server restart", () => {
  let root: string;
  let server: ViteDevServer | undefined;

  beforeEach(() => {
    root = fs.mkdtempSync(
      path.join(fs.realpathSync.native(os.tmpdir()), "dev-restart-"),
    );
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    fs.rmSync(root, { recursive: true, force: true });
  });

  // Vite restarts with a new server and websocket after a config edit.
  it("should keep the restarted server registered for client errors", async () => {
    server = await createViteDevServer({
      root,
      configFile: false,
      logLevel: "silent",
    });
    await server.restart();

    const devGlobal = getDevGlobal();
    assert.equal(devGlobal.devServers.size, 1);

    const port = (server.config.server.hmr as { port: number }).port;
    assert.equal(await reachesClientCallback(port), true);

    await server.close();
    server = undefined;
    assert.equal(devGlobal.devServers.size, 0);
  });
});

function reachesClientCallback(port: number) {
  return new Promise<boolean>((resolve) => {
    let cookie = "";
    const res = {
      setHeader(_name: string, value: string) {
        cookie = value.split(";")[0];
      },
    } as unknown as ServerResponse;
    const timeout = setTimeout(() => resolve(false), 2000);
    getDevGlobal().onClient(res, () => {
      clearTimeout(timeout);
      resolve(true);
    });

    const ws = new WebSocket(`ws://localhost:${port}`, {
      protocols: "vite-hmr",
      headers: { cookie },
    } as unknown as string);
    ws.onopen = () => ws.close();
    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
  });
}

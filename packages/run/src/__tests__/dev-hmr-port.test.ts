import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import type { ViteDevServer } from "vite";

import { createViteDevServer } from "../adapter/dev-server";
import { isPortInUse } from "../vite/utils/server";

const viteDefaultHmrPort = 24678;

function connects(port: number) {
  return new Promise<boolean>((resolve) => {
    const ws = new WebSocket(`ws://localhost:${port}`, "vite-hmr");
    ws.onopen = () => {
      ws.close();
      resolve(true);
    };
    ws.onerror = () => resolve(false);
  });
}

describe("dev server hmr port", () => {
  const servers: ViteDevServer[] = [];
  const roots: string[] = [];

  function create(root: string) {
    return createViteDevServer({ root, configFile: false, logLevel: "silent" });
  }

  beforeEach(() => {
    for (const name of ["a", "b"]) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), `hmr-${name}-`));
      roots.push(root);
    }
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Vite's fixed middleware-mode default means a second instance cannot bind
  // and its live reload silently attaches to the first server.
  it("should give concurrent servers their own working websocket", async () => {
    servers.push(await create(roots[0]), await create(roots[1]));
    const ports = servers.map(
      (server) => (server.config.server.hmr as { port: number }).port,
    );

    assert.notEqual(ports[0], ports[1]);
    assert.equal(await connects(ports[0]), true);
    assert.equal(await connects(ports[1]), true);
  });

  it("should keep Vite's default port while it is free", async function () {
    if (await isPortInUse(viteDefaultHmrPort)) {
      this.skip();
    }
    const server = await create(roots[0]);
    servers.push(server);
    assert.equal(
      (server.config.server.hmr as { port: number }).port,
      viteDefaultHmrPort,
    );
    assert.equal(await connects(viteDefaultHmrPort), true);
  });

  it("should leave a configured hmr port alone", async () => {
    const port = 24999;
    const server = await createViteDevServer({
      root: roots[0],
      configFile: false,
      logLevel: "silent",
      server: { hmr: { port } },
    });
    servers.push(server);
    assert.equal((server.config.server.hmr as { port: number }).port, port);
    assert.equal(await connects(port), true);
  });
});

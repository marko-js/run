import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import http, { type ServerResponse } from "http";
import os from "os";
import path from "path";
import type { ViteDevServer } from "vite";

import { createViteDevServer, getDevGlobal } from "../adapter/dev-server";

describe("dev server restart", () => {
  let root: string;
  let server: ViteDevServer | undefined;

  beforeEach(() => {
    // The real path keeps Windows 8.3 short names (RUNNER~1 on CI) out of
    // the watched root, where they abort node in libuv's fs-event assert.
    root = fs.mkdtempSync(
      path.join(fs.realpathSync.native(os.tmpdir()), "restart-"),
    );
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("should still hand the client socket to onClient after Vite restarts", async () => {
    const port = 24998;
    server = await createViteDevServer({
      root,
      configFile: false,
      logLevel: "silent",
      server: { hmr: { port } },
    });
    await server.restart();

    let cookie = "";
    const response = {
      setHeader(_name: string, value: string) {
        cookie = value.split(";")[0];
      },
    } as unknown as ServerResponse;
    const handed = new Promise<boolean>((resolve) => {
      getDevGlobal().onClient(response, () => resolve(true));
      setTimeout(() => resolve(false), 2000);
    });
    await connect(port, cookie);

    assert.equal(await handed, true);
  });
});

// A WebSocket handshake with a cookie, which the WebSocket API cannot send.
function connect(port: number, cookie: string) {
  return new Promise<void>((resolve, reject) => {
    http
      .request({
        port,
        headers: {
          connection: "Upgrade",
          upgrade: "websocket",
          "sec-websocket-version": "13",
          "sec-websocket-key": crypto.randomBytes(16).toString("base64"),
          "sec-websocket-protocol": "vite-hmr",
          cookie,
        },
      })
      .on("upgrade", (_res, socket) => {
        socket.destroy();
        resolve();
      })
      .on("error", reject)
      .end();
  });
}

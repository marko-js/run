import { createServer, type InlineConfig, type ViteDevServer } from "vite";
import { createMiddleware } from "./middleware";
import type { IncomingMessage, ServerResponse } from "http";
import { inspect } from "util";
import logger from "./logger";

interface DevErrorCallback {
  id: string;
  expires: number;
  callback: (ws: WebSocket) => void;
}

export interface MarkoRunDev {
  readonly devServers: ReadonlySet<ViteDevServer>;
  addDevServer(devServer: ViteDevServer): void;
  clear(): void;
  onClient(res: ServerResponse, callaback: (ws: WebSocket) => void): void;
}

declare global {
  var __marko_run_dev__: MarkoRunDev | undefined;
}

export async function createViteDevServer(
  config?: InlineConfig
): Promise<ViteDevServer> {
  const devServer = await createServer({
    ...config,
    appType: "custom",
    server: { ...config?.server, middlewareMode: true },
  });

  getDevGlobal().addDevServer(devServer);

  devServer.middlewares.use(logger());

  return devServer;
}

export async function createDevServer(
  config?: InlineConfig
): Promise<ViteDevServer> {
  const devServer = await createViteDevServer(config);
  const routerMiddleware = createMiddleware((request, platform) =>
    globalThis.__marko_run__.fetch(request, platform)
  );
  devServer.middlewares.use(async (req, res, next) => {
    function handleNext(err: unknown) {
      if (err) {
        if (err instanceof Error) {
          devServer.ssrFixStacktrace(err);
        }

        console.error(err);

        if (res.headersSent) {
          if (!res.destroyed) {
            (res.socket as any)?.destroySoon();
          }
        } else {
          res.statusCode = 500;
          res.end(
            inspect(err).replace(
              /([\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g,
              ""
            )
          );
        }
      } else {
        next?.();
      }
    }

    try {
      await devServer.ssrLoadModule("@marko/run/router");
    } catch (err) {
      return handleNext(err);
    }
    routerMiddleware(req, res, handleNext);
  });
  return devServer;
}

const ClientIdCookieName = "marko-run-client-id";

function getClientId(req: IncomingMessage) {
  if (req.headers.cookie) {
    const cookie = req.headers.cookie
      .split(/;\s+/)
      .find((c) => c.startsWith(ClientIdCookieName));
    if (cookie) {
      return cookie.slice(ClientIdCookieName.length + 1);
    }
  }
}

let devGlobal: MarkoRunDev | undefined;
export function getDevGlobal(): MarkoRunDev {
  if (!devGlobal) {
    const devServers = new Set<ViteDevServer>();
    let callbacks: DevErrorCallback[] = [];

    function handleConnection(ws: WebSocket, req: IncomingMessage) {
      if (callbacks?.length) {
        const id = getClientId(req);
        const now = Date.now();
        const nextCallbacks: DevErrorCallback[] = [];
        for (const entry of callbacks) {
          if (entry.id === id) {
            entry.callback(ws);
          } else if (entry.expires > now) {
            nextCallbacks.push(entry);
          }
        }
        callbacks = nextCallbacks;
      }
    }

    globalThis.__marko_run_dev__ = devGlobal = {
      devServers,
      addDevServer(devServer) {
        const originalClose = devServer.close;
        devServer.close = () => {
          devServers.delete(devServer);
          return originalClose.call(devServer);
        };
        devServers.add(devServer);

        devServer.ws.on("connection", handleConnection);
      },
      clear() {
        callbacks = [];
        for (const devServer of devServers) {
          devServer.ws.off("connection", handleConnection);
          devServer.close();
        }
      },
      onClient(res, callback) {
        const expires = Date.now() + 1000;
        const id = Math.floor(Math.random() * expires).toString(36);
        callbacks.push({
          id,
          expires,
          callback,
        });

        res.setHeader(
          "set-cookie",
          `${ClientIdCookieName}=${id}; Path=/; Max-Age=100; HttpOnly`
        );
      },
    };
  }

  return devGlobal;
}

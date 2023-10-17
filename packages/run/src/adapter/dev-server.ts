import { createServer, type InlineConfig, type ViteDevServer } from "vite";
import { createMiddleware, type NodeMiddleware } from "./middleware";
import stripAnsi from "strip-ansi";
import type { IncomingMessage } from "http";

interface DevErrorCallback {
  id: string;
  expires: number;
  callback: (ws: WebSocket) => void;
}

export interface MarkoRunDev {
  readonly devServers: ReadonlySet<ViteDevServer>;
  addDevServer(devServer: ViteDevServer): void;
  clear(): void;
  onClient(callaback: (ws: WebSocket) => void): (response: Response) => void;
}

declare global {
  var __marko_run_dev__: MarkoRunDev | undefined;
}

export function createViteDevMiddleware<T>(
  devServer: ViteDevServer,
  load: (prev: T | undefined) => Promise<T>,
  factory: (value: T) => NodeMiddleware
): NodeMiddleware {
  let value: T | undefined;
  let middleware: NodeMiddleware;

  return async (req, res, next) => {
    try {
      const nextValue = await load(value);
      if (nextValue !== value) {
        value = nextValue;
        middleware = factory(value);
      }
      await middleware(req, res, next);
    } catch (err) {
      res.statusCode = 500;
      if (err instanceof Error) {
        devServer.ssrFixStacktrace(err);
        res.end(err.stack && stripAnsi(err.stack));
      } else {
        res.end();
      }
    }
  };
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
    await devServer.ssrLoadModule("@marko/run/router");
    routerMiddleware(req, res, (err) => {
      if (err) {
        res.statusCode = 500;
        if (err instanceof Error) {
          devServer.ssrFixStacktrace(err);
          res.end(err.stack && stripAnsi(err.stack));
        } else {
          res.end();
        }
      } else {
        next?.();
      }
    });
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
      onClient(
        callback: (ws: WebSocket) => void
      ): (response: Response) => void {
        const expires = Date.now() + 1000;
        const id = Math.floor(Math.random() * expires).toString(36);
        callbacks.push({
          id,
          expires,
          callback,
        });

        return (response) => {
          response.headers.append(
            "set-cookie",
            `${ClientIdCookieName}=${id}; Path=/; Max-Age=100; HttpOnly`
          );
        };
      },
    };
  }

  return devGlobal;
}

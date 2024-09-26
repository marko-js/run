import type { IncomingMessage, ServerResponse } from "http";
import path from "path";
import {
  createServer,
  type Rollup,
  type Connect,
  type InlineConfig,
  type ViteDevServer,
  buildErrorMessage,
} from "vite";
import { createMiddleware } from "./middleware";
import logger from "./logger";
import { prepareError } from "./utils";

type RollupError = Rollup.RollupError;

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
  config?: InlineConfig,
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
  config?: InlineConfig,
): Promise<ViteDevServer> {
  const devServer = await createViteDevServer(config);
  const routerMiddleware = createMiddleware((request, platform) =>
    globalThis.__marko_run__.fetch(request, platform),
  );
  devServer.middlewares
    .use(async (req, res, next) => {
      try {
        await devServer.ssrLoadModule("@marko/run/router");
      } catch (err) {
        return next(err);
      }
      routerMiddleware(req, res, next);
    })
    .use(createErrorMiddleware(devServer));
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
          `${ClientIdCookieName}=${id}; Path=/; Max-Age=100; HttpOnly`,
        );
      },
    };
  }

  return devGlobal;
}

export function createErrorMiddleware(
  devServer: ViteDevServer,
): Connect.ErrorHandleFunction {
  return function errorMiddleware(error: RollupError, _req, res, _next) {
    if (!error.id) {
      devServer.config.logger.error(buildErrorMessage(error, [`\x1b[31;1mRequest failed with error: ${error.message}\x1b[0m`]));
    }
    res.statusCode = 500;
    res.end(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Error</title>
    <script type="module">
      const error = ${JSON.stringify(prepareError(error)).replace(
        /</g,
        "\\u003c",
      )}
      try {
        const { ErrorOverlay } = await import(${JSON.stringify(path.posix.join(devServer.config.base, "/@vite/client"))})
        document.body.appendChild(new ErrorOverlay(error))
      } catch {
        const h = (tag, text) => {
          const el = document.createElement(tag)
          el.textContent = text
          return el
        }
        document.body.appendChild(h('h1', 'Internal Server Error'))
        document.body.appendChild(h('h2', error.message))
        document.body.appendChild(h('pre', error.stack))
        document.body.appendChild(h('p', '(Error overlay failed to load)'))
      }
    <\/script>
  </head>
  <body>
  </body>
</html>
    `);
  };
}

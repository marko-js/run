import { installPolyfills } from "./polyfill";
import type { Fetch } from "../runtime";
import type { IncomingMessage, ServerResponse } from "http";
import type { ViteDevServer } from "vite";
import { OutgoingMessage } from "http";
import { TLSSocket } from "tls";

installPolyfills();

declare module "net" {
  interface Socket {
    destroySoon(): void;
  }
}

declare module "http" {
  interface IncomingMessage {
    ip?: string;
    protocol?: string;
  }

  interface ServerResponse {
    flush?: () => void;
  }
}

export interface NodePlatformInfo {
  ip: string;
  request: IncomingMessage;
  response: ServerResponse;
  setCookie(cookie: string): void;
}

/** Connect/Express style request listener/middleware */
export type NodeMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void
) => void;

/** Adapter options */
export interface NodeAdapterOptions {
  /**
   * Set the origin part of the URL to a constant value.
   * It defaults to `process.env.ORIGIN`. If neither is set,
   * the origin is computed from the protocol and hostname.
   * To determine the protocol, `req.protocol` is tried first.
   * If `trustProxy` is set, `X-Forwarded-Proto` header is used.
   * Otherwise, `req.socket.encrypted` is used.
   * To determine the hostname, `X-Forwarded-Host`
   * (if `trustProxy` is set) or `Host` header is used.
   */
  origin?: string;
  /**
   * Whether to trust `X-Forwarded-*` headers. `X-Forwarded-Proto`
   * and `X-Forwarded-Host` are used to determine the origin when
   * `origin` and `process.env.ORIGIN` are not set. `X-Forwarded-For`
   * is used to determine the IP address. The leftmost values are used
   * if multiple values are set. Defaults to true if `process.env.TRUST_PROXY`
   * is set to `1`, otherwise false.
   */
  trustProxy?: boolean;
  devServer?: ViteDevServer;
}

// TODO: Support the newer `Forwarded` standard header
function getForwardedHeader(req: IncomingMessage, name: string) {
  const value = req.headers["x-forwarded-" + name];
  if (value) {
    if (typeof value === "string") {
      const index = value.indexOf(",");
      return index < 0 ? value : value.slice(0, index);
    }
    return value[0];
  }
}

export function getOrigin(req: IncomingMessage, trustProxy?: boolean): string {
  const protocol =
    req.protocol ||
    (trustProxy && getForwardedHeader(req, "proto")) ||
    ((req.socket as TLSSocket).encrypted ? "https" : "http");

  let host =
    req.headers.host || (trustProxy && getForwardedHeader(req, "host"));

  if (!host) {
    if (process.env.NODE_ENV !== "production") {
      host = "localhost";
      console.warn(
        `Could not automatically determine the origin host, using 'localhost'. Use the 'origin' option or the 'ORIGIN' environment variable to set the origin explicitly.`
      );
    } else {
      throw new Error(
        `Could not automatically determine the origin host. Use the 'origin' option or the 'ORIGIN' environment variable to set the origin explicitly.`
      );
    }
  }

  return `${protocol}://${host}`;
}

const inExpiresDateRgs = /Expires\s*=\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*$/i;
export function setResponseHeaders(response: Response, res: OutgoingMessage) {
  for (const [key, value] of response.headers) {
    if (key === "set-cookie") {
      let sepIndex = value.indexOf(",") + 1;
      if (!sepIndex) {
        res.setHeader(key, value);
      } else {
        let index = 0;
        do {
          const valuePart = value.slice(index, sepIndex - 1);
          if (!inExpiresDateRgs.test(valuePart)) {
            res.appendHeader(key, valuePart);
            index = sepIndex;
          }
          sepIndex = value.indexOf(",", sepIndex) + 1;
        } while (sepIndex);

        res.appendHeader(key, value.slice(index));
      }
    } else {
      res.setHeader(key, value);
    }
  }
}

/**
 * Creates a request handler to be passed to http.createServer() or used as a
 * middleware in Connect-style frameworks like Express.
 */
export function createMiddleware(
  fetch: Fetch<NodePlatformInfo>,
  options: NodeAdapterOptions = {}
): NodeMiddleware {
  const {
    origin = process.env.ORIGIN,
    trustProxy = process.env.TRUST_PROXY === "1",
    devServer,
  } = options;

  return async (req, res, next) => {
    const controller = new AbortController();
    const { signal } = controller;
    const url = new URL(req.url!, origin || getOrigin(req, trustProxy));
    const ip =
      req.ip ||
      (trustProxy && getForwardedHeader(req, "for")) ||
      req.socket.remoteAddress ||
      "";
    const headers = req.headers as HeadersInit;
    // TODO: Do we need to remove http2 psuedo headers?
    // if (headers[":method"]) {
    //   headers = Object.fromEntries(
    //     Object.entries(headers).filter(([key]) => !key.startsWith(":"))
    //   );
    // }

    req.on("error", onError);
    res.on("error", onError);
    req.socket.on("error", onError);

    function onError(err: Error) {
      req.off("error", onError);
      res.off("error", onError);
      req.socket.off("error", onError);
      controller.abort(err);
    }

    if (process.env.NODE_ENV !== "production" && devServer) {
      devServer.ws.on("connection", function onConnection(ws: WebSocket) {
        devServer!.ws.off("connection", onConnection);
        if (signal.aborted) {
          sendError();
        } else {
          signal.addEventListener("abort", sendError);
        }

        function sendError() {
          const { message, stack = "" } = signal.reason;
          ws.send(
            JSON.stringify({
              type: "error",
              err: { message, stack },
            })
          );
        }
      });
    } else {
      signal.addEventListener("abort", () => {
        if (!res.destroyed && res.socket) {
          res.socket.destroySoon();
        }
      });
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : (req as any as ReadableStream),
      // @ts-expect-error: Node requires this for streams
      duplex: "half",
      signal,
    });

    const response = await fetch(request, {
      ip,
      request: req,
      response: res,
      setCookie(cookie) {
        res.appendHeader("set-cookie", cookie);
      },
    });

    if (!response) {
      if (next) {
        next();
      }
      return;
    }

    res.statusCode = response.status;
    setResponseHeaders(response, res);

    if (!response.body) {
      if (!response.headers.has("content-length")) {
        res.setHeader("content-length", "0");
      }
      res.end();
      return;
    } else if (res.destroyed) {
      controller.abort(new Error("Response stream destroyed"));
      return;
    }

    writeResponse(response.body.getReader(), res, controller);
  };
}

async function writeResponse(
  reader: ReadableStreamDefaultReader,
  res: ServerResponse,
  controller: AbortController
) {
  try {
    while (!controller.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      } else if (!res.write(value)) {
        res.once("drain", () => writeResponse(reader, res, controller));
        return;
      } else if (res.flush) {
        res.flush();
      }
    }
  } catch (err) {
    controller.abort(err);
  }
}

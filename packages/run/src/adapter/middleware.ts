import "./polyfill";
import type { Fetch } from "../runtime";
import type { IncomingMessage, ServerResponse, OutgoingMessage } from "http";
import type { TLSSocket } from "tls";


export interface NodePlatformInfo {
  ip: string;
  request: IncomingMessage;
  response: ServerResponse;
}

/** Connect/Express style request listener/middleware */
export type NodeMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (error?: Error) => void
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
    (req as any).protocol ||
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
    if (key !== "set-cookie") {
      res.setHeader(key, value);
    }
  }

  const setCookies = getSetCookie(response.headers);
  if (setCookies?.length) {
    res.setHeader("set-cookie", setCookies);
  }
}

const getSetCookie = (Headers.prototype.getSetCookie as any)
  ? getSetCookie_platform
  : getSetCookie_fallback;

function getSetCookie_platform(headers: Headers) {
  return headers.getSetCookie();
}

export function getSetCookie_fallback(headers: Headers) {
  const value = headers.get("set-cookie");
  if (!value) return undefined;

  let sepIndex = value.indexOf(",") + 1;
  if (!sepIndex) return value;

  let index = 0;
  let setCookie = undefined;
  let setCookies = undefined;
  do {
    const valuePart = value.slice(index, sepIndex - 1);
    if (!inExpiresDateRgs.test(valuePart)) {
      if (setCookies) {
        setCookies.push(valuePart);
      } else if (setCookie) {
        setCookies = [setCookie, valuePart];
      } else {
        setCookie = valuePart;
      }
      index = sepIndex;
      while (value.charCodeAt(index) === 32) index++;
    }
    sepIndex = value.indexOf(",", sepIndex) + 1;
  } while (sepIndex);

  if (index) {
    const valuePart = value.slice(index);
    if (setCookies) {
      setCookies.push(valuePart);
      return setCookies;
    }
    return [setCookie!, valuePart];
  }

  return value;
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
  } = options;

  return async (req, res, next) => {
    const controller = new AbortController();
    const { signal } = controller;
    const url = new URL(req.url!, origin || getOrigin(req, trustProxy));
    const ip =
      (req as any).ip ||
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

    req.on("error", onErrorOrClose);
    req.socket.on("error", onErrorOrClose);
    res.on("error", onErrorOrClose);
    res.on("close", onErrorOrClose);
    signal.addEventListener("abort", onSignalAborted);

    function onErrorOrClose(err?: Error) {
      req.off("error", onErrorOrClose);
      req.socket.off("error", onErrorOrClose);
      res.off("error", onErrorOrClose);
      res.off("close", onErrorOrClose);
      if (err) {
        signal.removeEventListener("abort", onSignalAborted);
        controller.abort(err);
      }
    }

    function onSignalAborted() {
      if (next) {
        next(signal.reason);
      } else {
        if (!res.destroyed && res.socket) {
          (res.socket as any).destroySoon();
        }
        console.error(signal.reason);
      }
    }

    let setDevClientId: ((response: Response) => void) | undefined;
    if (
      process.env.NODE_ENV !== "production" &&
      globalThis.__marko_run_dev__ &&
      req.headers.accept?.includes("text/html")
    ) {
      setDevClientId = globalThis.__marko_run_dev__.onClient((ws) => {
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
    });

    if (!response) {
      if (next) {
        next();
      }
      return;
    }

    if (process.env.NODE_ENV !== "production" && setDevClientId) {
      setDevClientId(response);
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
      } else if ((res as any).flush) {
        (res as any).flush();
      }
    }
  } catch (err) {
    controller.abort(err);
  }
}

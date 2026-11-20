import { Readable } from "node:stream";

import { IncomingMessage, ServerResponse } from "http";
import { isIPv6 } from "net";
import type { TLSSocket } from "tls";

import type { Fetch, Platform } from "../runtime";

export interface NodePlatformInfo {
  request: IncomingMessage;
  response: ServerResponse;
}

/** Connect/Express style request listener/middleware */
export type NodeMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (error?: Error) => void,
) => void;

/** Adapter options */
export interface NodeMiddlewareOptions {
  /**
   * Set the origin part of the URL to a constant value.
   * It defaults to `process.env.ORIGIN`. If neither is set,
   * the origin is computed from the protocol and hostname.
   * The protocol is `X-Forwarded-Proto` (if `trustProxy` is set),
   * else `https` for a TLS socket, else `req.protocol`, else `http`.
   * The hostname is `X-Forwarded-Host` (if `trustProxy` is set)
   * or the `Host` header. A request whose protocol or host is not a valid
   * `http(s)` scheme and `host[:port]` is answered with a 400.
   */
  origin?: string;
  /**
   * Whether to trust the `X-Forwarded-Proto` and `X-Forwarded-Host`
   * headers, which determine the origin when `origin` and
   * `process.env.ORIGIN` are not set. The leftmost value is used if a
   * header has several. Defaults to true if `process.env.TRUST_PROXY`
   * is set to `1`, otherwise false.
   */
  trustProxy?: boolean;

  /**
   * Creates the `platform` passed to route handlers from the Node request and
   * response, and the web `Request` built from them. Defaults to the former.
   */
  createPlatform?(platform: NodePlatformInfo, request: Request): Platform;
}

/** Returns `null` when the protocol or host headers are not a valid origin. */
export function getOrigin(
  req: IncomingMessage,
  trustProxy?: boolean,
): string | null {
  const protocol =
    (trustProxy && getForwardedHeader(req, "proto")) ||
    ((req.socket as TLSSocket).encrypted && "https") ||
    (req as any).protocol ||
    "http";

  let host =
    (trustProxy && getForwardedHeader(req, "host")) || req.headers.host;

  if (!host) {
    if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
      host = "localhost";
      console.warn(
        `Could not automatically determine the origin host, using 'localhost'. Use the 'origin' option or the 'ORIGIN' environment variable to set the origin explicitly.`,
      );
    } else {
      return null;
    }
  }

  const origin = `${protocol}://${host}`;
  const match = originPattern.exec(origin);
  return match && (!match[1] || isIPv6(match[1])) ? origin : null;
}

// `http(s)://host[:port]` with an RFC 3986 host: a bracketed IPv6 literal
// (captured) or reg-name characters. Checked on the final values because
// Express's `req.protocol` can echo the header.
const originPattern =
  /^https?:\/\/(?:\[([0-9a-f:.]+)\]|[a-z0-9\-._~!$&'()*+,;=]+)(?::0*(?:\d{1,4}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d\d|655[0-2]\d|6553[0-5])?)?$/i;

export function copyResponseHeaders(
  response: ServerResponse,
  headers: Headers,
) {
  for (const [key, value] of headers) {
    // Each `Vary` token is a requirement, so one set by earlier middleware is kept.
    if (key === "vary") {
      response.appendHeader(key, value);
    } else if (key !== "set-cookie") {
      response.setHeader(key, value);
    }
  }

  const setCookies = headers.getSetCookie();
  if (setCookies?.length) {
    response.appendHeader("set-cookie", setCookies);
  }
}

/**
 * Creates a request handler to be passed to http.createServer() or used as a
 * middleware in Connect-style frameworks like Express.
 */
export function createMiddleware(
  fetch: Fetch<Platform>,
  options: NodeMiddlewareOptions = {},
): NodeMiddleware {
  const {
    origin = process.env.ORIGIN,
    trustProxy = process.env.TRUST_PROXY === "1",
    createPlatform = (platform) => platform,
  } = options;

  return async (req, res, next) => {
    // A client disconnect surfaces as the response closing before it
    // finished; abort so handlers can observe it via `request.signal`.
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) {
        controller.abort();
      }
    });

    try {
      if (
        (!process.env.NODE_ENV || process.env.NODE_ENV === "development") &&
        globalThis.__marko_run_dev__ &&
        req.headers.accept?.includes("text/html")
      ) {
        // eslint-disable-next-line no-var
        var devWebSocket: WebSocket | undefined;
        globalThis.__marko_run_dev__.onClient(res, (ws) => {
          devWebSocket = ws;
        });
      }

      let body: BodyInit | undefined;
      switch (req.method) {
        case "POST":
        case "PUT":
        case "PATCH":
        case "QUERY":
          if (Readable.isDisturbed(req)) {
            body = bodyConsumedErrorStream;
          } else {
            body = req as unknown as ReadableStream;
          }
          break;
      }

      // The request target is read as a path, so one like `//evil.example/` or
      // `http://evil.example/` cannot change the host.
      const base = origin || getOrigin(req, trustProxy);
      if (!base) {
        res
          .writeHead(400, { "content-length": "0", connection: "close" })
          .end();
        return;
      }

      const url = new URL(
        req.url![0] === "/" ? base + req.url : `${base}/${req.url}`,
      );
      const request = new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body,
        // @ts-expect-error: Node requires this for streams
        duplex: "half",
      });

      // An own property because `new Request(url, { signal })` wires the signal
      // into undici, which can retain the request until the signal is collected.
      Object.defineProperty(request, "signal", {
        configurable: true,
        value: controller.signal,
      });

      const platform = createPlatform(
        {
          request: req,
          response: res,
        },
        request,
      );

      const response = await fetch(request, platform);

      if (res.destroyed || res.headersSent) {
        // The request ended while `fetch` was pending; the response is
        // discarded, so release whatever its body still holds open.
        if (response) {
          try {
            getBodyReader(response)?.cancel();
          } catch {
            // A body someone else holds a reader on is theirs to finish.
          }
        }
        return;
      }

      if (response) {
        const reader = getBodyReader(response);
        if (reader) {
          controller.signal.addEventListener("abort", reader.cancel, {
            once: true,
          });

          try {
            // The head goes on once the body produces, so a body that fails
            // first leaves `res` as it was for the error response.
            let result = await reader.read();
            if (res.destroyed || res.headersSent) return;
            writeResponseHead(res, response);
            for (; !result.done; result = await reader.read()) {
              if (res.destroyed) return;
              res.write(result.value);
              (res as any).flush?.();
            }
          } finally {
            controller.signal.removeEventListener("abort", reader.cancel);
            reader.cancel();
          }
        } else {
          writeResponseHead(res, response);
          if (
            !response.headers.has("content-length") &&
            req.method !== "HEAD" &&
            response.status !== 204 &&
            response.status !== 304
          ) {
            res.setHeader("content-length", "0");
          }
        }

        res.end();
      } else if (next) {
        next();
      }
    } catch (err) {
      // A disconnect surfaces here as whatever the handler threw once its
      // signal aborted; there is no client left to answer.
      if (controller.signal.aborted && res.destroyed) {
        return;
      }

      // A handler can throw a primitive; reading properties off it would crash
      // the process, and converting it to text can throw again in this catch.
      const error =
        err instanceof Error
          ? err
          : new Error("Unknown error handling request");

      if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
        if (error.cause && !error.message) {
          error.message = (error.cause as any).message;
          error.stack ||= (error.cause as any).stack;
        }

        devWebSocket?.send(
          JSON.stringify({
            type: "error",
            err: { message: error.message, stack: error.stack || "" },
          }),
        );
      }

      if (next) {
        next(error);
      } else {
        res.socket?.destroySoon();
        console.error(error);
      }
    }
  };
}

// Set in `runtime/internal`: writing a page's raw render strings to the socket
// lets node encode UTF-8 natively, skipping the re-encode `body` would do.
const kRender = Symbol.for("@marko/run.render");

/**
 * Gets a `read`/`cancel` pair over the response's body, or `null` when there is
 * none. The stashed Marko render is preferred while the body is still the
 * untouched one it was stashed with (`clone()` tees it away). A stream goes
 * through a reader because only `reader.cancel()` settles a read parked
 * between chunks and runs the stream's `cancel()`. `cancel` swallows
 * rejections — the request is over either way.
 */
export function getBodyReader(response: Response) {
  const direct = (response as any)[kRender] as
    { render: AsyncIterable<string>; body: ReadableStream } | undefined;

  if (
    direct &&
    direct.body === response.body &&
    !response.bodyUsed &&
    !response.body.locked
  ) {
    const iterator = direct.render[Symbol.asyncIterator]();
    return {
      read: () => iterator.next(),
      cancel() {
        Promise.resolve(iterator.return?.()).catch(() => {});
      },
    };
  }

  if (!response.body) {
    return null;
  }

  const reader =
    response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  return {
    read: () => reader.read(),
    cancel() {
      reader.cancel().catch(() => {});
    },
  };
}

function writeResponseHead(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  copyResponseHeaders(res, response.headers);
}

// TODO: Support the newer `Forwarded` standard header
function getForwardedHeader(req: IncomingMessage, name: string) {
  const value = req.headers["x-forwarded-" + name];
  if (value) {
    if (typeof value === "string") {
      const index = value.indexOf(",");
      return (index < 0 ? value : value.slice(0, index)).trim();
    }
    return value[0].trim();
  }
}

const bodyConsumedErrorStream = new ReadableStream({
  pull(controller) {
    controller.error(
      new Error(
        "The request body stream has been destroyed or consumed by something before Marko Run.",
      ),
    );
  },
});

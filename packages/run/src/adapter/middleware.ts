import { appendHeader, getSetCookie } from "./polyfill";
import type { Fetch, Platform } from "../runtime";
import { IncomingMessage, ServerResponse } from "http";
import type { TLSSocket } from "tls";
import { Readable } from 'node:stream'

export interface NodePlatformInfo {
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
export interface NodeMiddlewareOptions {
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

  createPlatform?(platform: NodePlatformInfo): Platform & NodePlatformInfo;
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
    (trustProxy && getForwardedHeader(req, "proto")) ||
    ((req.socket as TLSSocket).encrypted && "https") ||
    (req as any).protocol || "http";

  let host =
    (trustProxy && getForwardedHeader(req, "host")) || req.headers.host;

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

export function copyResponseHeaders(
  response: ServerResponse,
  headers: Headers
) {
  for (const [key, value] of headers) {
    if (key !== "set-cookie") {
      response.setHeader(key, value);
    }
  }

  const setCookies = getSetCookie(headers);
  if (setCookies?.length) {
    appendHeader(response, "set-cookie", setCookies);
  }
}

function normalizeError(error: Error) {
  if (error.cause && !error.message) {
    error.message = (error.cause as any).message;
    error.stack ||= (error.cause as any).stack;
  }
  return error;
}

/**
 * Creates a request handler to be passed to http.createServer() or used as a
 * middleware in Connect-style frameworks like Express.
 */
export function createMiddleware(
  fetch: Fetch<Platform>,
  options?: NodeMiddlewareOptions
): NodeMiddleware {
  const {
    origin = process.env.ORIGIN,
    trustProxy = process.env.TRUST_PROXY === "1",
    createPlatform = (platform) => platform,
  } = (options ??= {});

  return async (req, res, next) => {
    const controller = new AbortController();
    const { signal } = controller;
    const url = new URL(req.url!, origin || getOrigin(req, trustProxy));

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
      const error = normalizeError(signal.reason);
      if (next) {
        next(error);
      } else {
        if (!res.destroyed && res.socket) {
          (res.socket as any).destroySoon();
        }
        console.error(error);
      }
    }

    if (
      process.env.NODE_ENV !== "production" &&
      globalThis.__marko_run_dev__ &&
      req.headers.accept?.includes("text/html")
    ) {
      globalThis.__marko_run_dev__.onClient(res, (ws) => {
        if (signal.aborted) {
          sendError();
        } else {
          signal.addEventListener("abort", sendError);
        }

        function sendError() {
          const { message, stack = "" } = normalizeError(signal.reason);
          ws.send(
            JSON.stringify({
              type: "error",
              err: { message, stack },
            })
          );
        }
      });
    }

    let body: BodyInit | undefined;
    switch (req.method) {
      case "POST":
      case "PUT":
      case "PATCH":
        if (Readable.isDisturbed(req)) {
          body = bodyConsumedErrorStream;
        } else {
          body = req as unknown as ReadableStream;
        }
        break;
    }
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body,
      // @ts-expect-error: Node requires this for streams
      duplex: "half",
      signal,
    });

    const platform = createPlatform({
      request: req,
      response: res,
    });

    let response: Response | void;
    try {
      response = await fetch(request, platform);
    } catch (err) {
      normalizeError(err as Error);
      if (next) {
        next(err as Error);
      } else {
        console.error(err);
      }
      return;
    }

    if (!response) {
      if (next) {
        next();
      }
      return;
    }

    res.statusCode = response.status;
    copyResponseHeaders(res, response.headers);

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
      }
      
      res.write(value);
      
      if ((res as any).flush) {
        (res as any).flush();
      }
    }
  } catch (err) {
    controller.abort(err);
  }
}

const bodyConsumedErrorStream = new ReadableStream({
  pull(controller) {
    controller.error(
      new Error(
        "The request body stream has been destroyed or consumed by something before Marko Run."
      )
    );
  }
});

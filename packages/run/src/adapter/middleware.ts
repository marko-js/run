import * as webStream from "stream/web";
import installCrypto from "@hattip/polyfills/crypto";
import type { RequestContext, Router } from "@marko/run";
import type { IncomingMessage, ServerResponse } from "http";
/*
  POLYFILL
  - cyrpto
  - web stream
*/
installCrypto();
for (const key of Object.keys(webStream)) {
  if (!(key in global)) {
    (global as any)[key] = (webStream as any)[key];
  }
}

declare module "net" {
  interface Socket {
    encrypted?: boolean;
  }
}

declare module "http" {
  interface IncomingMessage {
    ip?: string;
    protocol?: string;
  }

  interface ServerResponse {
    appendHeader(key: string, value: string | string[]): this;
  }
}

declare module "@marko/run" {
  interface Platform extends NodePlatformInfo {}
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
  res: ServerResponse & { flush?: () => void },
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

export function getOrigin(
  req: IncomingMessage,
  protocol?: string,
  host?: string,
  trustProxy?: boolean
): string {
  protocol ??=
    req.protocol ||
    (trustProxy && getForwardedHeader(req, "proto")) ||
    (req.socket?.encrypted && "https") ||
    "http";

  host ??= (trustProxy && getForwardedHeader(req, "host")) || req.headers.host;

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

/**
 * Creates a request handler to be passed to http.createServer() or used as a
 * middleware in Connect-style frameworks like Express.
 */
export default function createMiddleware(
  router: Router<NodePlatformInfo>,
  options: NodeAdapterOptions = {}
): NodeMiddleware {
  const { trustProxy = process.env.TRUST_PROXY === "1" } = options;

  let { origin = process.env.ORIGIN } = options;
  let protocol: string | undefined;
  let host: string | undefined;
  if (origin) {
    ({ protocol, host } = new URL(origin));
    protocol = protocol.slice(0, -1);
  }

  return async (req, res, next) => {
    origin ??= getOrigin(req, protocol, host, trustProxy);

    const url = new URL(req.url!, origin);
    const ip =
      req.ip ||
      (trustProxy && getForwardedHeader(req, "for")) ||
      req.socket.remoteAddress ||
      "";

    const platform: NodePlatformInfo = {
      ip,
      request: req,
      response: res,
      setCookie(cookie) {
        res.appendHeader("set-cookie", cookie);
      },
    };

    const context: Omit<RequestContext, "request"> = {
      method: req.method!,
      url,
      platform,
    };

    Object.defineProperty(context, "request", {
      get() {
        const headers = req.headers as any;
        // TODO: Do we need to remove http2 psuedo headers?
        // if (headers[":method"]) {
        //   headers = Object.fromEntries(
        //     Object.entries(headers).filter(([key]) => !key.startsWith(":"))
        //   );
        // }

        const body =
          req.method === "GET" || req.method === "HEAD"
            ? undefined
            : req.socket // Deno has no req.socket and can't convert req to ReadableStream
            ? (req as unknown as ReadableStream)
            : // Convert to a ReadableStream for Deno
              new ReadableStream({
                start(controller) {
                  req.on("data", (chunk) => controller.enqueue(chunk));
                  req.on("end", () => controller.close());
                  req.on("error", (err) => controller.error(err));
                },
              });

        const request = new Request(url, {
          method: req.method,
          headers,
          body,

          // @ts-expect-error: Node requires this for streams
          duplex: "half",
        });

        Object.defineProperty(this, "request", {
          value: request,
          enumerable: true,
          configurable: true,
        });

        return request;
      },
      enumerable: true,
      configurable: true,
    });

    const response = await router(context as RequestContext<NodePlatformInfo>);

    if (!response) {
      if (next) {
        next();
      } else {
        res.statusCode = 404;
        res.setHeader("content-length", "0");
        res.end();
        return;
      }
      return;
    }

    res.statusCode = response.status;
    for (const [key, value] of response.headers) {
      if (key === "set-cookie") {
        let sepIndex = value.indexOf(",") + 1;
        if (!sepIndex) {
          res.setHeader(key, value);
        } else {
          let index = 0;
          do {
            res.appendHeader(key, value.slice(index, sepIndex - 1));
            index = sepIndex;
            sepIndex = value.indexOf(",", sepIndex) + 1;
          } while (sepIndex);

          res.appendHeader(key, value.slice(index));
        }
      } else {
        res.setHeader(key, value);
      }
    }

    if (!response.body) {
      if (!response.headers.has("content-length")) {
        res.setHeader("content-length", "0");
      }
      res.end();
      return;
    }

    const reader = response.body.getReader();
    if (res.destroyed) {
      reader.cancel();
      return;
    }
    res.on("close", cancel);
    res.on("error", cancel);
    write();

    function cancel(error?: Error) {
      res.off("close", cancel);
      res.off("error", cancel);
      reader.cancel(error).catch(() => {});
      error && res.destroy(error);
    }

    async function write() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          } else if (!res.write(value)) {
            res.once("drain", write);
            return;
          } else if (res.flush) {
            res.flush();
          }
        }
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error("Error while writing to node response", {
                cause: err,
              });
        cancel(error);
      }
    }

    // const contentLengthSet = response.headers.get("content-length");
    // if (response.body) {
    //   if (contentLengthSet) {
    //     for await (const chunk of response.body as any) {
    //       res.write(Buffer.from(chunk));
    //       res.flush?.();
    //     }
    //   } else {
    //     const reader = (
    //       response.body as any as AsyncIterable<Buffer | string>
    //     )[Symbol.asyncIterator]();

    //     // const reader = response.body.getReader();
    //     // reader.read()

    //     const first = await reader.next();
    //     if (first.done) {
    //       res.setHeader("content-length", "0");
    //     } else {
    //       const secondPromise = reader.next();
    //       let second = await Promise.race([
    //         secondPromise,
    //         Promise.resolve(null),
    //       ]);

    //       if (second && second.done) {
    //         res.setHeader("content-length", first.value.length);
    //         res.write(first.value);
    //         res.flush?.();
    //       } else {
    //         res.write(first.value);
    //         res.flush?.();
    //         second = await secondPromise;
    //         for (; !second.done; second = await reader.next()) {
    //           res.write(Buffer.from(second.value));
    //           res.flush?.();
    //         }
    //       }
    //     }
    //   }
    // } else if (!contentLengthSet) {
    //   res.setHeader("content-length", "0");
    // }

    // res.end();
  };
}

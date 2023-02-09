import { router } from "@marko/run/router";
import type { RequestContext } from "@marko/run";
import type {
  HandlerEvent,
  HandlerContext,
  HandlerResponse,
} from "@netlify/functions";
import type { NetlifyFunctionsPlatformInfo } from "./types";

export async function handler(
  event: HandlerEvent,
  context: HandlerContext
): Promise<HandlerResponse> {
  const requestContext = {
    method: event.httpMethod,
    url: new URL(event.rawUrl),
    platform: {
      event,
      context,
      ip: event.headers["x-nf-client-connection-ip"]!,
    },
  } as RequestContext<NetlifyFunctionsPlatformInfo>;

  Object.defineProperty(requestContext, "request", {
    get() {
      const request = new Request(event.rawUrl, {
        method: event.httpMethod,
        headers: event.headers as HeadersInit,
        body:
          !event.body ||
          event.httpMethod === "GET" ||
          event.httpMethod === "HEAD"
            ? undefined
            : event.isBase64Encoded
            ? Buffer.from(event.body, "base64")
            : event.body,

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

  const response = await router(requestContext);

  const res: HandlerResponse = {
    statusCode: 404,
  };

  if (response) {
    const { body, status, headers } = response;
    res.statusCode = status;

    for (const [key, value] of headers) {
      if (key === "set-cookie" && value.indexOf(",") !== -1) {
        res.multiValueHeaders = { [key]: value.split(",") };
      } else {
        (res.headers ??= {})[key] = value;
      }
    }

    if (!body) {
      res.body = "";
    } else if (typeof body === "string") {
      res.body = body;
    } else if (body instanceof Uint8Array) {
      res.body = Buffer.from(body).toString("base64");
      res.isBase64Encoded = true;
    } else {
      res.body = await response.text();
    }
  }

  return res;
}

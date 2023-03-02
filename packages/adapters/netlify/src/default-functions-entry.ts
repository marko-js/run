import { fetch } from "@marko/run/router";
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
  const request = new Request(event.rawUrl, {
    method: event.httpMethod,
    headers: event.headers as HeadersInit,
    body:
      !event.body || event.httpMethod === "GET" || event.httpMethod === "HEAD"
        ? undefined
        : event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : event.body,

    // @ts-expect-error: Node requires this for streams
    duplex: "half",
  });

  const response = await fetch<NetlifyFunctionsPlatformInfo>(request, {
    event,
    context,
    ip: event.headers["x-nf-client-connection-ip"]!,
  });

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

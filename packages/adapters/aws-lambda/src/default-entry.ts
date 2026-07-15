import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { fetch } from "@marko/run/router";

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  AWSLambdaPlatformInfo,
  LambdaContext,
} from "./types";

const publicDir = new URL("./public/", import.meta.url);

const mimeTypes: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  wasm: "application/wasm",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml",
};

function eventToRequest(event: APIGatewayProxyEventV2): Request {
  const { method } = event.requestContext.http;
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers)) {
    if (value !== undefined) {
      headers.set(key, value);
    }
  }
  if (event.cookies?.length) {
    headers.set("cookie", event.cookies.join("; "));
  }

  const host =
    headers.get("x-forwarded-host") ||
    headers.get("host") ||
    event.requestContext.domainName;
  const proto = headers.get("x-forwarded-proto") || "https";
  const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `${proto}://${host}${event.rawPath}${query}`;

  let body: Uint8Array | string | undefined;
  if (method !== "GET" && method !== "HEAD" && event.body != null) {
    body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : event.body;
  }

  return new Request(url, { method, headers, body });
}

async function responseToResult(
  response: Response,
): Promise<APIGatewayProxyResultV2> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (key !== "set-cookie") {
      headers[key] = value;
    }
  });
  const cookies =
    "getSetCookie" in response.headers
      ? response.headers.getSetCookie()
      : undefined;
  const body = Buffer.from(await response.arrayBuffer());

  return {
    statusCode: response.status,
    headers,
    cookies: cookies?.length ? cookies : undefined,
    body: body.toString("base64"),
    isBase64Encoded: true,
  };
}

async function serveStatic(
  pathname: string,
): Promise<APIGatewayProxyResultV2 | null> {
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const fileUrl = new URL("." + pathname, publicDir);
  // Guard against path traversal outside of the public directory.
  if (!fileUrl.href.startsWith(publicDir.href)) {
    return null;
  }

  let data: Buffer;
  try {
    data = await readFile(fileURLToPath(fileUrl));
  } catch {
    return null;
  }

  const ext = pathname.slice(pathname.lastIndexOf(".") + 1).toLowerCase();
  const headers: Record<string, string> = {
    "content-type": mimeTypes[ext] || "application/octet-stream",
  };
  if (pathname.startsWith("/assets/")) {
    headers["cache-control"] = "public, max-age=31536000, immutable";
  }

  return {
    statusCode: 200,
    headers,
    body: data.toString("base64"),
    isBase64Encoded: true,
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
  context: LambdaContext,
): Promise<APIGatewayProxyResultV2> {
  const request = eventToRequest(event);
  const platform: AWSLambdaPlatformInfo = { event, context };

  // Let matched routes respond first; only fall back to static assets when the
  // router reports no match (the runtime returns a 404 response in that case).
  const response = await fetch<AWSLambdaPlatformInfo>(request, platform);
  if (response && response.status !== 404) {
    return responseToResult(response);
  }

  const { pathname } = new URL(request.url);
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return { statusCode: 400, body: "" };
  }
  const staticResult = await serveStatic(decodedPathname);
  if (staticResult) {
    return staticResult;
  }

  return response ? responseToResult(response) : { statusCode: 404, body: "" };
}

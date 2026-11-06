import type { NodePlatformInfo } from "@marko/run/adapter";
import type { Context } from "@netlify/functions";
import { randomUUID } from "crypto";
import type { ServerResponse } from "http";

/**
 * Creates the `platform` routes get in `marko-run dev`: a local stand-in for
 * the Netlify `Context` the deployed function receives. Values only Netlify
 * knows (geolocation, site and deploy details) are left empty.
 */
export function createDevPlatform(
  { request: nodeRequest, response }: NodePlatformInfo,
  request: Request,
): Context {
  return {
    account: { id: "" },
    cookies: {
      get: (name) => parseCookies(request.headers.get("cookie"))[name],
      set: ((cookie: Cookie | string, value?: string) => {
        setCookie(
          response,
          typeof cookie === "string" ? { name: cookie, value: value! } : cookie,
        );
      }) as Context["cookies"]["set"],
      delete(input) {
        const options = typeof input === "string" ? { name: input } : input;
        setCookie(response, { ...options, value: "", expires: new Date(0) });
      },
    },
    deploy: { context: "dev", id: "", published: false },
    geo: {},
    ip: nodeRequest.socket.remoteAddress || "",
    json: (input) => Response.json(input),
    log: console.log,
    next: () => Promise.resolve(createFallthrough()),
    params: {},
    rewrite: () => Promise.reject(unavailable("rewrite")),
    requestId: randomUUID(),
    server: {},
    site: {},
    url: new URL(request.url),
    waitUntil(promise) {
      promise.catch((err) => console.error(err));
    },
  };
}

/**
 * Whether `response` is the one `context.next()` resolved to and was returned
 * unchanged, meaning the request should go on to the next dev middleware.
 */
export function isFallthrough(response: unknown) {
  return fallthroughs.has(response as Response);
}

const fallthroughs = new WeakSet<Response>();

function createFallthrough() {
  const response = new Response("Not Found", { status: 404 });
  fallthroughs.add(response);
  return response;
}

function unavailable(method: string) {
  return new Error(
    `\`context.${method}()\` isn't available in \`marko-run dev\`. Use \`marko-run preview\` to run on Netlify's dev server.`,
  );
}

function setCookie(response: ServerResponse, cookie: Cookie) {
  if (response.headersSent) {
    console.warn(
      `Cookie '${cookie.name}' was not set: the response headers were already sent.`,
    );
  } else {
    response.appendHeader("set-cookie", serializeCookie(cookie));
  }
}

/** Browsers send the most specific cookie first, so the first of a name wins. */
function parseCookies(header: string | null) {
  const cookies: Record<string, string> = {};
  for (const pair of header?.split(";") || []) {
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    if (index > 0 && !(name in cookies)) {
      cookies[name] = decodeCookieValue(pair.slice(index + 1).trim());
    }
  }
  return cookies;
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function serializeCookie(cookie: Cookie) {
  const parts = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
  if (cookie.expires !== undefined) {
    parts.push(`Expires=${new Date(cookie.expires).toUTCString()}`);
  }
  if (cookie.maxAge !== undefined) parts.push(`Max-Age=${cookie.maxAge}`);
  if (cookie.domain) parts.push(`Domain=${cookie.domain}`);
  parts.push(`Path=${cookie.path || "/"}`);
  if (cookie.secure) parts.push("Secure");
  if (cookie.httpOnly) parts.push("HttpOnly");
  if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`);
  if (cookie.unparsed) parts.push(...cookie.unparsed);
  return parts.join("; ");
}

/** The cookie `context.cookies.set` takes, from `@netlify/types`. */
interface Cookie {
  name: string;
  value: string;
  expires?: Date | number;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  unparsed?: string[];
}

import { webcrypto } from "crypto";
import { ServerResponse } from "http";
import * as webStream from "stream/web";
import * as undici from "undici";

(globalThis as any).crypto ??= webcrypto;
(globalThis as any).fetch ??= undici.fetch;
(globalThis as any).Response ??= undici.Response;
(globalThis as any).Request ??= undici.Request;
(globalThis as any).Headers ??= undici.Headers;
(globalThis as any).ReadableStream ??= webStream.ReadableStream;
(globalThis as any).TransformStream ??= webStream.TransformStream;
(globalThis as any).WritableStream ??= webStream.WritableStream;
(globalThis as any).FormData ??= undici.FormData;
(globalThis as any).File ??= undici.File;

declare global {
  interface Headers {
    getSetCookie: () => string[];
  }
}

export const appendHeader = (ServerResponse.prototype.appendHeader as any)
  ? appendHeader_platform
  : appendHeader_fallback;

function appendHeader_platform(
  response: ServerResponse,
  name: string,
  value: string | readonly string[],
) {
  response.appendHeader(name, value);
}

function appendHeader_fallback(
  response: ServerResponse,
  name: string,
  value: string | readonly string[],
) {
  const existing = response.getHeader(name);
  if (existing === undefined) {
    response.setHeader(name, value);
  } else if (Array.isArray(existing)) {
    response.setHeader(name, existing.concat(value));
  } else {
    response.setHeader(name, [String(existing)].concat(value));
  }
}

export const getSetCookie = (Headers.prototype.getSetCookie as any)
  ? getSetCookie_platform
  : getSetCookie_fallback;

function getSetCookie_platform(headers: Headers) {
  return headers.getSetCookie();
}

const inExpiresDateRgs = /Expires\s*=\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*$/i;
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

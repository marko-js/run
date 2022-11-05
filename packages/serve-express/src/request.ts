import { once } from "events";
import { Readable } from "stream";
import { Request as _Request } from "undici";
import type { Connect } from "vite";
import type { ServerResponse } from "http";

Object.assign(globalThis, {
  Request: _Request
});

export function createWebRequest(req: Connect.IncomingMessage, url: URL) {
  return new Request(url, {
    method: req.method,
    headers: req.headers as any,
    referrer: req.headers.referer || "",
    body: req.method === "POST" ? req as any : null,
  });
}

export async function applyWebResponse(
  res: ServerResponse,
  webRes: Response
): Promise<void> {
  res.statusCode = webRes.status;
  res.statusMessage = webRes.statusText;

  webRes.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  if (webRes.body) {
    const readable = Readable.from(webRes.body as any);
    readable.pipe(res);
    await once(readable, "end");
  } else {
    res.end();
  }
}
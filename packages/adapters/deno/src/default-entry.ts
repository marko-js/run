import { fetch } from "@marko/run/router";

import type { DenoPlatformInfo } from "./types";

// Minimal declaration of the Deno runtime APIs used by this entry. The file is
// excluded from `tsc` and bundled by Vite for the Deno runtime, where these
// globals exist.
declare const Deno: {
  serve(
    options: { port: number },
    handler: (
      request: Request,
      info: DenoPlatformInfo,
    ) => Response | Promise<Response>,
  ): unknown;
  open(path: URL, options: { read: boolean }): Promise<{ readable: BodyInit }>;
  env: { get(key: string): string | undefined };
  errors: { NotFound: new () => Error };
};

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

async function serveStatic(pathname: string): Promise<Response | null> {
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const fileUrl = new URL("." + pathname, publicDir);
  // Guard against path traversal outside of the public directory.
  if (!fileUrl.href.startsWith(publicDir.href)) {
    return null;
  }

  try {
    const file = await Deno.open(fileUrl, { read: true });
    const ext = pathname.slice(pathname.lastIndexOf(".") + 1).toLowerCase();
    const headers: Record<string, string> = {
      "content-type": mimeTypes[ext] || "application/octet-stream",
    };
    if (pathname.startsWith("/assets/")) {
      headers["cache-control"] = "public, max-age=31536000, immutable";
    }
    return new Response(file.readable, { headers });
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return null;
    }
    throw err;
  }
}

const port = Number(Deno.env.get("PORT")) || 3000;

Deno.serve({ port }, async (request, info) => {
  // Let matched routes respond first; only fall back to static assets when the
  // router reports no match (the runtime returns a 404 response in that case).
  const response = await fetch<DenoPlatformInfo>(request, info);
  if (response && response.status !== 404) {
    return response;
  }

  const { pathname } = new URL(request.url);
  const staticResponse = await serveStatic(decodeURIComponent(pathname));
  if (staticResponse) {
    return staticResponse;
  }

  return response || new Response(null, { status: 404 });
});

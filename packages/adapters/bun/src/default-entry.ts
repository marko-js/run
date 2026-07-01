import { fetch } from "@marko/run/router";

import type { BunPlatformInfo } from "./types";

// Minimal declaration of the Bun runtime APIs used by this entry. The file is
// excluded from `tsc` and bundled by Vite for the Bun runtime, where these
// globals exist.
interface BunFile extends Blob {
  exists(): Promise<boolean>;
}
declare const Bun: {
  serve(options: {
    port: number;
    fetch(
      request: Request,
      server: BunPlatformInfo,
    ): Response | Promise<Response>;
  }): unknown;
  file(path: string | URL): BunFile;
};

const publicDir = new URL("./public/", import.meta.url);

async function serveStatic(pathname: string): Promise<Response | null> {
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const fileUrl = new URL("." + pathname, publicDir);
  // Guard against path traversal outside of the public directory.
  if (!fileUrl.href.startsWith(publicDir.href)) {
    return null;
  }

  const file = Bun.file(fileUrl);
  if (!(await file.exists())) {
    return null;
  }

  // Bun infers the content-type from the file. Assets are content-hashed, so
  // they can be cached indefinitely.
  const headers = pathname.startsWith("/assets/")
    ? { "cache-control": "public, max-age=31536000, immutable" }
    : undefined;
  return new Response(file, { headers });
}

Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(request, server) {
    // Let matched routes respond first; only fall back to static assets when
    // the router reports no match (the runtime returns a 404 response in that
    // case).
    const response = await fetch<BunPlatformInfo>(request, server);
    if (response && response.status !== 404) {
      return response;
    }

    const { pathname } = new URL(request.url);
    const staticResponse = await serveStatic(decodeURIComponent(pathname));
    if (staticResponse) {
      return staticResponse;
    }

    return response || new Response(null, { status: 404 });
  },
});

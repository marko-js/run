import { fetch } from "@marko/run/router";

import { createPlatform } from "./runtime";

// Vercel's Node.js runtime calls `fetch` with a web `Request` for each request.
export default {
  async fetch(request: Request): Promise<Response> {
    return (
      (await fetch(request, createPlatform())) ||
      new Response(null, { status: 404 })
    );
  },
};

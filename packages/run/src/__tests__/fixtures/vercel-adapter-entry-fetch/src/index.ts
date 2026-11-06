import { fetch } from "@marko/run/router";
import { createPlatform } from "@marko/run-adapter-vercel/runtime";

export default {
  async fetch(request: Request) {
    const response = await fetch(request, createPlatform());
    return response || new Response("Not Found", { status: 404 });
  },
};

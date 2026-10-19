import type {
  DurableObjectNamespace,
  ExecutionContext,
  Request as CfRequest,
} from "@cloudflare/workers-types";
import { fetch } from "@marko/run/router";
import { heldOpen } from "@marko/run-adapter-cloudflare/runtime";
import { DurableObject } from "cloudflare:workers";

interface Env {
  GREETER: DurableObjectNamespace<Greeter>;
}

// A Worker entry of the app's own can export what its Wrangler config binds.
export class Greeter extends DurableObject {
  async fetch() {
    return new Response("Hello from a Durable Object");
  }
}

export default {
  async fetch(request: CfRequest, env: Env, ctx: ExecutionContext) {
    const greeter = env.GREETER.get(env.GREETER.idFromName("greeter"));
    const greeting = await (await greeter.fetch("https://greeter/")).text();
    const response = await fetch(request as any, { env, ctx, greeting });
    return response
      ? heldOpen(response, ctx)
      : new Response(null, { status: 404 });
  },
};

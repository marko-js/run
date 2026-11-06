import { fetch } from "@marko/run/router";

export default async (request: Request, context: unknown) =>
  (await fetch(request, context as any)) ??
  new Response(null, { status: 404 });

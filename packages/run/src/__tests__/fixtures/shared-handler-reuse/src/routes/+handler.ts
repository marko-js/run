import type { Context, NextFunction } from "@marko/run";

// A shared utility function used across multiple verbs
function handler(_ctx: Context, next: NextFunction) {
  return next();
}

// Single-handler form: previously set handler.verb = "GET", tagging the original function
export const GET = Run.GET(handler);

// Array form: previously threw "Expected verb POST but handler was defined with Run.GET"
// because handler was mutated in the GET registration above
export const POST = Run.POST([handler, () => new Response("POST ok")]);

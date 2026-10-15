import type { ExecutionContext } from "@cloudflare/workers-types";

/**
 * Keeps the Worker alive until a streamed response has fully flushed. Wrap
 * the router's response with it in a custom entry; the default entry does.
 *
 * Marko's HTML runtime batches its stream writes through one module-level
 * queue and drains it on a `setImmediate` scheduled as the last chunk is
 * pulled. workerd discards a timer once the request that set it has no live
 * I/O context, which for a streamed body is the moment it closes, so the
 * drain never ran and no later render streamed. Holding the context one
 * macrotask past the body's end lets it run.
 */
export function heldOpen(response: Response, ctx: ExecutionContext): Response {
  if (!response.body) return response;
  let done!: () => void;
  const closed = new Promise<void>((resolve) => (done = resolve));
  ctx.waitUntil(
    closed.then(() => new Promise<void>((resolve) => setTimeout(resolve, 0))),
  );
  // `cancel` (a reader going away) is newer than these DOM types.
  const end: Transformer & { cancel(): void } = {
    flush: () => done(),
    cancel: () => done(),
  };
  const body = response.body.pipeThrough(new TransformStream(end));
  return new Response(body, response);
}

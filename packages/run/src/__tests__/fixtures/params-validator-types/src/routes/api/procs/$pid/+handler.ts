export const DELETE = Run.DELETE(
  {
    params({ pid }) {
      return { pid };
    },
  },
  (ctx) => {
    return Response.json({ pid: ctx.params.pid });
  },
);

// This route has no middleware upstream, so its namespace resolves to the
// return-checking CheckedDefineHandler.
export const validReturns = [
  Run.GET(() => new Response("ok")),
  Run.GET(async () => Response.json({ ok: true })),
  Run.GET((ctx, next) => next()),
];
// @ts-expect-error a handler cannot return a bare number
export const badNumber = Run.GET(() => 42);
// @ts-expect-error a handler cannot return a bare object in place of a Response
export const badObject = Run.GET(() => ({ plain: "object" }));

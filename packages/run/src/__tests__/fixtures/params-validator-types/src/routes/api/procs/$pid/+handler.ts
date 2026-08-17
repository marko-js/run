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

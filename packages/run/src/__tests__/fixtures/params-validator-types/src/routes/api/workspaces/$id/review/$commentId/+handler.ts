export const DELETE = Run.DELETE(
  {
    params({ id, commentId }) {
      return { id, commentId: Number(commentId) };
    },
  },
  (ctx) => {
    return Response.json({
      id: ctx.params.id,
      commentId: ctx.params.commentId,
    });
  },
);

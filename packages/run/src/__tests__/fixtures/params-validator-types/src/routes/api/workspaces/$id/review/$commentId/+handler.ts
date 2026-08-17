export const DELETE = Run.DELETE(
  {
    params({ id, commentId }) {
      return { id, commentId: Number(commentId) };
    },
  },
  (ctx) => {
    const validated: number = ctx.params.commentId;
    const upstream: string = ctx.data.workspace;
    // @ts-expect-error the validator types commentId as number
    const badParam: boolean = ctx.params.commentId;
    // @ts-expect-error the middleware data types workspace as string
    const badData: boolean = ctx.data.workspace;
    void validated, void upstream, void badParam, void badData;
    return Response.json({
      id: ctx.params.id,
      commentId: ctx.params.commentId,
    });
  },
);

export const options = Run.options({
  params({ id, commentId }) {
    return { id, commentId: Number(commentId) };
  },
});

export const DELETE = Run.DELETE((ctx) => {
  const validated: number = ctx.params.commentId;
  const upstream: string = ctx.data.workspace;
  const fromMiddleware: number = ctx.search.limit;
  // @ts-expect-error the validator types commentId as number
  const badParam: boolean = ctx.params.commentId;
  // @ts-expect-error the middleware data types workspace as string
  const badData: boolean = ctx.data.workspace;
  // @ts-expect-error the middleware search validator types limit as number
  const badSearch: boolean = ctx.search.limit;
  void validated, void upstream, void fromMiddleware, void badParam;
  void badData, void badSearch;
  return Response.json({
    id: ctx.params.id,
    commentId: ctx.params.commentId,
  });
});

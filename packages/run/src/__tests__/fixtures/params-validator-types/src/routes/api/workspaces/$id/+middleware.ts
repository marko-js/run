export const options = Run.options({
  search({ limit }) {
    return { limit: limit ? Number(limit) : 0 };
  },
});

export default Run.ALL((ctx, next) => {
  if ("commentId" in ctx.params) {
    const merged: number = ctx.params.commentId;
    // @ts-expect-error the DELETE validator types commentId as number
    const bad: boolean = ctx.params.commentId;
    void merged, void bad;
  }
  return next({ workspace: `ws-${ctx.params.id}` });
});

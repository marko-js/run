import type { Context, GetContext } from "@marko/run";

export const DELETE = Run.DELETE(
  {
    params({ id, commentId }) {
      return { id, commentId: Number(commentId) };
    },
  },
  (ctx) => {
    const asPlainContext: Context = ctx;
    const asScopedContext: GetContext<"/api/workspaces/$id/review/$commentId"> =
      ctx;
    // @ts-expect-error the deprecated MarkoRun.Context types params as raw
    // strings, so a context whose validator produced a number never fit it
    const asLegacyContext: MarkoRun.Context = ctx;
    void asPlainContext, void asScopedContext, void asLegacyContext;
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
  },
);

export const routeLevel: number = null as unknown as Run.Context["params"]["commentId"];
// @ts-expect-error route-level params keep the validated number type
export const routeLevelBad: boolean = null as unknown as Run.Context["params"]["commentId"];

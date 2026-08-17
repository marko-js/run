import * as v from "valibot";

export const QUERY = Run.QUERY(
  {
    json: {
      validator: v.object({
        search: v.string(),
      }),
    },
  },
  async (ctx, next) => {
    const [body, bodyIssues] = await ctx.body;
    if (bodyIssues) {
      return new Response(null, { status: 400 });
    }
    return next({ search: body.search });
  },
);

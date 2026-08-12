import * as v from "valibot";

export const POST = Run.POST(
  {
    json: {
      validator: v.object({
        name: v.string(),
        age: v.number()
      }),
      maxBytes: 256,
    },
  },
  async (ctx) => {
    await ctx.body; // verify body can be accessed multiple times
    const [_body, bodyIssues] = await ctx.body;
    if (bodyIssues) {
      return Response.json(
        {
          issues: bodyIssues,
        },
        { status: 200 },
      );
    }
    return Response.json(
      {
        issues: null,
      },
      { status: 200 },
    );
  },
);

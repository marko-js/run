import * as v from "valibot";

export const POST = Run.POST(
  {
    form: v.object({
      name: v.string(),
      age: v.pipe(v.string(), v.toNumber()),
      file: v.pipe(v.file(), v.mimeType(["text/plain"])) 
    }),
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

import * as v from "valibot";

export const GET = Run.GET(
  {
    search: v.object({
      q: v.optional(v.string()),
    }),
  },
  async (ctx) => {
    const [search] = ctx.search;
    return new Response(`<p>Searched for ${search?.q}</p>`, {
      headers: { "content-type": "text/html" },
    });
  },
);

export const GET = Run.GET(async (ctx) => {
  return ctx.redirect(Run.href("/search", { search: { q: "marko" } }));
});

export const GET = Run.GET(async (ctx) => {
  // @ts-expect-error explicit options must still match the route's options
  Run.href<"/search", { hash: boolean }>("/search", { hash: true });
  Run.href("/search", { search: { tag: ["a", "b"] } });
  return ctx.redirect(Run.href("/search", { search: { q: "marko" } }));
});

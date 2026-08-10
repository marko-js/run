export const GET = Run.GET(() => {
  // The Next.js/Remix habit: return data and expect the framework to serialize.
  return { items: ["a", "b"] } as never;
});

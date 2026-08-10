export const GET = Run.GET({}, (ctx, next) => {
  return next({ value: "data from GET handler" });
});

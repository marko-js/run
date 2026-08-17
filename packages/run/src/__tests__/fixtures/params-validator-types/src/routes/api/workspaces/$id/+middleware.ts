export default Run.ALL((ctx, next) => {
  return next({ workspace: `ws-${ctx.params.id}` });
});

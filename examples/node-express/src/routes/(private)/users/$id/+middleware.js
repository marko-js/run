export default function (ctx, next) {
  if (parseInt(ctx.params.id, 10) % 2) {
    throw new Error('HAHAHAHA! An error.');
  }
  return next();
}
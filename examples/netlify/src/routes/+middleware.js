export default async function(ctx, next) {
  const requestName = `${ctx.request.method} ${ctx.url.href}`;
  let success = true;
  console.log(`${requestName} request started`, { meta: ctx.meta })
  const startTime = performance.now();
  try {
    return await next();
  } catch (err) {
    success = false;
    throw err;
  } finally {
    console.log(`${requestName} completed ${success ? 'successfully' : 'with errors'} in ${performance.now() - startTime}ms`);
  }
}
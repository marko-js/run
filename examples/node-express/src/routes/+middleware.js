export default async function ({ request, url, meta }, next) {
  const requestName = `${request.method} ${url.href}`;
  let success = true;
  console.log(`${requestName} request started`, { meta });
  const startTime = performance.now();
  try {
    return await next();
  } catch (err) {
    success = false;
    throw err;
  } finally {
    console.log(
      `${requestName} completed ${
        success ? "successfully" : "with errors"
      } in ${performance.now() - startTime}ms`,
    );
  }
}

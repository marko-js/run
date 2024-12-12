export const GET = ((ctx) => {
  return Response.redirect(new URL("/other", ctx.url), 301);
}) satisfies MarkoRun.Handler;
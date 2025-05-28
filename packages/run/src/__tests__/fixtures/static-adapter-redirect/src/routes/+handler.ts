export const GET = ((ctx) => {
  return Response.redirect(new URL("/other", ctx.url));
}) satisfies MarkoRun.Handler;
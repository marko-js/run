export const GET: MarkoRun.Handler = ({ url }) => {
  return Response.redirect(new URL("/other", url));
}
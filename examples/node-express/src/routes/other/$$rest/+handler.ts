export const GET: MarkoRun.Handler = ({ request }, next) => {
  return request.headers.get("Accept")?.includes("text/html")
    ? next()
    : new Response(null, { status: 404 });
};

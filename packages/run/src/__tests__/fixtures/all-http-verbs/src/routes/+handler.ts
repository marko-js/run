const bodyHandler: MarkoRun.Handler = (context) => {
  return new Response(
    `handler: ${context.request.method} ${context.url.pathname}`,
    { headers: { "content-type": "text/plain" } },
  );
};

const nopBodyHandler: MarkoRun.Handler = (_context) => {
  return new Response();
};

export const POST = bodyHandler;
export const PUT = bodyHandler;
export const DELETE = bodyHandler;
export const PATCH = bodyHandler;
export const HEAD = nopBodyHandler
export const OPTIONS = nopBodyHandler;
export const CONNECT = nopBodyHandler;
export const TRACE = nopBodyHandler;

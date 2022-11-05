export function get(ctx: { request: Request}, next: () => Response): Response {
  return ctx.request.headers.get('Accept')?.includes('text/html') ? next() : new Response(null, { status: 404 });
}

export function post() {}
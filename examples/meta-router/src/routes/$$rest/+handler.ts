// export function get(ctx: { request: Request}, next: () => Response): Response {
//   console.log('here',ctx.request.headers.get('Accept'));

//   if (ctx.request.headers.get('Accept')?.includes('text/html')) {
//     return next()
//   }
//   return new Response(null, { status: 404 });
// }

export function post() {}
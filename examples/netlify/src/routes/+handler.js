function post(ctx) {
  return new Response('posted', { status: 200 });
}

function put(ctx) {
  return new Response('posted', { status: 200 });
}

// function get(ctx, next) {
//   console.log('home route entry.js!')
//   return next();
// }

export function del(ctx, next) {
  return next();
}

export { post, put, };
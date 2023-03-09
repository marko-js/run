export const POST: MarkoRun.Handler = () => {
  return new Response('POST-ed', { status: 200 });
}

export const PUT: MarkoRun.Handler = () => {
  return new Response('PUT-ed', { status: 200 });
}

export const GET: MarkoRun.Handler = () => {
  console.log('Home route handler')
}

export const DELETE: MarkoRun.Handler = () => {
  return new Response('DELETE-ed', { status: 200 });
}
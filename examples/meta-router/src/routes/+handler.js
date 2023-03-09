export function POST() {
  return new Response('posted', { status: 200 });
}

export function GET(_, next) {
  console.log(`'/' route GET handler`)
  return next();
}
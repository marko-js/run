export const POST = Run.POST(
  (context) =>
    new Response(`posted ${context.params.rest}`, {
      headers: { "content-type": "text/plain" },
    }),
);

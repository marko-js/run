export const POST = MarkoRun.route(async (context) => {
  const formData = await context.request.formData();
  return new Response(JSON.stringify({
    'formData': [...formData],
  }))
});
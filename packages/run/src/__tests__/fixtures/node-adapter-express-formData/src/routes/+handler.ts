export const POST = Run.POST(async (context) => {
  const formData = await context.request.formData();
  return new Response(JSON.stringify({
    'formData': [...formData],
  }))
});
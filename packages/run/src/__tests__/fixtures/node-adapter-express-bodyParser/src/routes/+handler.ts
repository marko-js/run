export const POST = Run.POST(async (context) => {
  try {
    const formData = await context.request.formData();
    return new Response(JSON.stringify({
      'formData': [...formData.entries()],
      'bodyParser': context.platform.request.body
    }))
  } catch (err) {
    return new Response((err as Error).message, { status: 500, headers: { "content-type": "text/plain" } });
  }
});
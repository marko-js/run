export const POST = Run.POST((context) => {
  // Declining hands the path back to the platform, which has a file here.
  if (context.params.rest === "passthrough.bin") {
    throw null;
  }
  return new Response(`posted ${context.params.rest}`, {
    headers: { "content-type": "text/plain" },
  });
});

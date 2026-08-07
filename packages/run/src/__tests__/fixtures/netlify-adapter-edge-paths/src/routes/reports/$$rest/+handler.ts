export const POST = Run.POST((context) => {
  // Declining lets the platform answer -- covered by the passthrough step.
  if (context.params.rest === "passthrough.bin") {
    throw null;
  }
  return new Response(`posted ${context.params.rest}`, {
    headers: { "content-type": "text/plain" },
  });
});

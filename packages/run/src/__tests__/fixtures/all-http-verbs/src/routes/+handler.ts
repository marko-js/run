const handler: MarkoRun.Handler = (context) => {
  return new Response(
    `handler: ${context.request.method} ${context.url.pathname}`,
    { headers: { "content-type": "text/plain" } },
  );
};

export { handler as POST }
export { handler as PUT }
export { handler as DELETE }
export { handler as PATCH }
export { handler as HEAD }
export { handler as OPTIONS }


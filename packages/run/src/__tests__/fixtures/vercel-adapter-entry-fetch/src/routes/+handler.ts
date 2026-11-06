import type { VercelPlatformInfo } from "@marko/run-adapter-vercel";

export const GET: MarkoRun.Handler = (context) => {
  const { waitUntil } = context.platform as VercelPlatformInfo;
  waitUntil(Promise.resolve());
  return new Response(
    `<p>fetch entry: ${context.url.pathname}, waitUntil: ${typeof waitUntil}</p>`,
    { headers: { "content-type": "text/html;charset=UTF-8" } },
  );
};

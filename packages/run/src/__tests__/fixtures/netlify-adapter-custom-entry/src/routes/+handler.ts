import type { NetlifyFunctionsPlatformInfo } from "@marko/run-adapter-netlify";

export const GET: MarkoRun.Handler = (context) => {
  const platform = context.platform as NetlifyFunctionsPlatformInfo;
  return new Response(
    `<p>custom entry, cookies: ${typeof platform.cookies?.get}, waitUntil: ${typeof platform.waitUntil}</p>`,
    { headers: { "content-type": "text/html;charset=UTF-8" } },
  );
};

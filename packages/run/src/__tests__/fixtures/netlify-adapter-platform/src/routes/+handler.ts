import type { NetlifyFunctionsPlatformInfo } from "@marko/run-adapter-netlify";

export const GET: MarkoRun.Handler = async (context) => {
  const platform = context.platform as NetlifyFunctionsPlatformInfo;
  platform.cookies.set({ name: "visited", value: "yes", httpOnly: true });
  platform.waitUntil(Promise.resolve());
  const json = await platform.json({ ok: true }).json();
  return new Response(
    `<p>path: ${platform.url.pathname}, ip: ${typeof platform.ip}, requestId: ${typeof platform.requestId}, json: ${json.ok}, cookie before: ${platform.cookies.get("visited") ?? "none"}</p>`,
    { headers: { "content-type": "text/html;charset=UTF-8" } },
  );
};

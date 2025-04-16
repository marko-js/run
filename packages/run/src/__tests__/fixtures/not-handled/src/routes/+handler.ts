import { ServerResponse } from "http";

export const GET = ((ctx) => {

  const res = (ctx.platform as any).response as ServerResponse;

  res.setHeader("content-type", "text/html;charset=UTF-8");
  res.write("<!DOCTYPE html><html><head></head><body>Rendered from handler on platform response</body></html>");
  res.end();

  return MarkoRun.NotHandled;
}) satisfies MarkoRun.Handler;
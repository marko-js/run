import { createWebRequest, applyWebResponse } from "../request";
import type { Router } from "@marko/serve";
import type { ServerResponse } from "http";
import type { Connect } from "vite";
import { createAsyncMiddleware } from "./utils";

export interface Options {
  createRequest?: (req: Connect.IncomingMessage, url: URL) => Request;
  applyResponse?: (
    res: ServerResponse,
    webRes: Response
  ) => Promise<void> | void;
}

function createMiddleware(
  router: Router,
  options: Options
): Connect.NextHandleFunction {
  const { createRequest = createWebRequest, applyResponse = applyWebResponse } =
    options;

  return async (req, res, next) => {
    console.log('Routing middleare')
    try {
      const url = new URL(req.originalUrl!, `http://${req.headers.host}`);
      const webReq = createRequest(req, url);
      const webRes = await router(webReq);
      if (webRes) {
        await applyResponse(res, webRes);
      } else {
        next();
      }
    } catch (err) {
      next(err);
    }
  };
}

export default function routerMiddleware(options: Options = {}) {
  return createAsyncMiddleware('RouterMW', async () => {
    if (process.env.NODE_ENV !== "production") {
      const { createServer } = await import("vite");
      const devServer = await createServer({
        appType: "custom",
        server: { middlewareMode: true },
      });

      return devServer.middlewares.use(async (req, res, next) => {

        console.log(`RouterMW: importing @marko/serve via ssrLoadModule`);
        const { router } = await devServer.ssrLoadModule("@marko/serve");
        console.log(`RouterMW: import complete`);
        
        const middleware = createMiddleware(router, options);
        return middleware(req, res, (err) => {
          if (err) devServer.ssrFixStacktrace(err as Error);
          next(err);
        });
      });
    }

    const { router } = await import("@marko/serve");
    return createMiddleware(router, options);
  });
}

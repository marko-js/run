import { createWebRequest, applyWebResponse } from "../request";
import type { MatchedRoute, RouteMatcher } from "@marko/serve";
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

namespace MetaRouter {
  export interface RouteConfig {
    _handler: Connect.NextHandleFunction;
    [key: string]: unknown;
  }
  export interface Route {
    invoke: Connect.NextHandleFunction,
    config: RouteConfig;
  }
}

function createRouteFromMatch(
  match: MatchedRoute,
  url: URL,
  options: Options
): MetaRouter.Route {
  const { createRequest = createWebRequest, applyResponse = applyWebResponse } =
    options;

  const invoke: Connect.NextHandleFunction = async (req, res, next) => {
    try {
      const webReq = createRequest(req, url);
      const webRes = await match.invoke(webReq as any);
      await applyResponse(res, webRes as any);
    } catch (err) {
      next(err);
    }
  };

  return {
    invoke,
    config: {
      ...(match.meta as any),
      _handler: invoke
    },
  };
}

export function createMiddleware(
  getMatchedRoute: RouteMatcher,
  options: Options
): Connect.NextHandleFunction {
  return (req, _res, next) => {
    console.log('Routing middleare')
    try {
      const url = new URL(req.originalUrl!, `http://${req.headers.host}`);
      const match = getMatchedRoute(req.method!, url);
      if (match) {
        console.log('Found match');
        (req as any).route = createRouteFromMatch(match, url, options);
      } else {
        console.log('No match found')
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export default function matchMiddleware(options: Options = {}) {
  return createAsyncMiddleware('MatchMW', async () => {
    if (process.env.NODE_ENV !== "production") {
      const { createServer } = await import("vite");
      const devServer = await createServer({
        appType: "custom",
        server: { middlewareMode: true },
      });

      return devServer.middlewares.use(async (req, res, next) => {
        const { getMatchedRoute } = await devServer.ssrLoadModule(
          "@marko/serve"
        );
        const middleware = createMiddleware(getMatchedRoute, options);
        middleware(req, res, (err) => {
          if (err) devServer.ssrFixStacktrace(err as Error);
          next(err);
        });
      });
    }

    const { getMatchedRoute } = await import("@marko/serve");
    return createMiddleware(getMatchedRoute, options);
  });
}

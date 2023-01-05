import { createMiddleware } from "@hattip/adapter-node";
import type { AdapterRequestContext } from "@hattip/core";
import type { NodePlatformInfo, NodeMiddleware } from "@hattip/adapter-node";
import type { MatchedRoute, RouteMatcher } from "@marko/serve";

export interface Route {
  invoke: NodeMiddleware;
  url: URL;
  match: MatchedRoute;
  config: {
    _handler: NodeMiddleware;
    [key: string]: unknown;
  };
}

type MatchedRequest = NodePlatformInfo["request"] & { route: Route };

const passthrough: NodeMiddleware = (_req, _res, next) => {
  next?.();
};

function asyncMiddleware<Options = undefined>(
  fn: (options?: Options) => Promise<NodeMiddleware>
) {
  return ((options: Options) => {
    const promise = fn(options).then((handler) => {
      middleware = handler;
    });
    let middleware: NodeMiddleware = async (req, res, next) => {
      await promise;
      middleware(req, res, next);
    };
    return (req, res, next) => middleware(req, res, next);
  }) as Options extends undefined
    ? () => NodeMiddleware
    : (options?: Options) => NodeMiddleware;
}

export const matchMiddleware = asyncMiddleware(async () => {
  const invoke = createMiddleware(async (context) => {
    const { request, platform } =
      context as AdapterRequestContext<NodePlatformInfo>;
    const { route } = platform.request as MatchedRequest;
    return await route.match.invoke(request);
  });

  const match = createMiddleware((context) => {
    const { request, platform } =
      context as AdapterRequestContext<NodePlatformInfo>;
    const url = new URL(request.url);
    const match = getMatchedRoute(request.method, url);

    if (match) {
      (platform.request as MatchedRequest).route = {
        invoke,
        url,
        match,
        config: {
          ...(match.meta as any),
          _handler: invoke,
        },
      };
    }
    context.passThrough();
    return new Response();
  });

  let getMatchedRoute: RouteMatcher;

  if (process.env.NODE_ENV !== "production") {
    const { createViteDevMiddleware } = await import("@marko/serve/adapter");
    const { createServer } = await import("vite");
    const devServer = await createServer({
      appType: "custom",
      server: { middlewareMode: true },
    });

    const devMiddleware = createViteDevMiddleware<RouteMatcher>(
      devServer,
      async () =>
        (await devServer.ssrLoadModule("@marko/serve")).getMatchedRoute,
      (matcher) => {
        getMatchedRoute = matcher;
        return match;
      }
    );

    return devServer.middlewares.use(devMiddleware);
  }

  ({ getMatchedRoute } = await import("@marko/serve"));
  return match;
});

export const routerMiddleware = asyncMiddleware(async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createDevServer } = await import("@marko/serve/adapter");
    return await createDevServer();
  }

  const { handler } = await import("@marko/serve");
  return createMiddleware(handler);
});

export const importRouterMiddleware = asyncMiddleware(async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const devServer = await createServer({
      appType: "custom",
      server: { middlewareMode: true },
    });

    return devServer.middlewares.use(async (_req, _res, next) => {
      await devServer.ssrLoadModule("@marko/serve");
      next();
    });
  }

  await import("@marko/serve");
  return passthrough;
});

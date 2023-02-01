import type { IncomingMessage } from "http";
import createMiddleware, {
  type NodeMiddleware,
} from "@marko/run/adapter/middleware";
import type { MatchRoute, Route, InvokeRoute } from "@marko/run";

export interface MatchedRoute {
  invoke: NodeMiddleware;
  match: Route;
  config: {
    _handler: NodeMiddleware;
    [key: string]: unknown;
  };
}

type MatchedRequest = IncomingMessage & { route: MatchedRoute };

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
  let matchRoute: MatchRoute;
  let invokeRoute: InvokeRoute;

  const invoke = createMiddleware((context) =>
    invokeRoute(
      (context.platform.request as MatchedRequest).route.match,
      context
    )
  );

  const match: NodeMiddleware = (req, _res, next) => {
    const match = matchRoute(req.method!, req.url!);

    if (match) {
      (req as MatchedRequest).route = {
        invoke,
        match,
        config: {
          ...(match.meta as any),
          _handler: invoke,
        },
      };
    }

    next?.();
  };

  if (process.env.NODE_ENV !== "production") {
    const { createViteDevMiddleware } = await import("@marko/run/adapter");
    const { createServer } = await import("vite");
    const devServer = await createServer({
      appType: "custom",
      server: { middlewareMode: true },
    });

    const devMiddleware = createViteDevMiddleware(
      devServer,
      async () => await devServer.ssrLoadModule("@marko/run/router"),
      (module) => {
        ({ matchRoute, invokeRoute } = module);
        return match;
      }
    );

    return devServer.middlewares.use(devMiddleware);
  }

  ({ matchRoute, invokeRoute } = await import("@marko/run/router"));
  return match;
});

export const routerMiddleware = asyncMiddleware(async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createDevServer } = await import("@marko/run/adapter");
    return await createDevServer();
  }
  return createMiddleware((await import("@marko/run/router")).router);
});

export const importRouterMiddleware = asyncMiddleware(async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const devServer = await createServer({
      appType: "custom",
      server: { middlewareMode: true },
    });

    return devServer.middlewares.use(async (_req, _res, next) => {
      await devServer.ssrLoadModule("@marko/run/router");
      next();
    });
  }

  await import("@marko/run/router");
  return passthrough;
});

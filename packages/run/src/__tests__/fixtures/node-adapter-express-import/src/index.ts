import express from "express";
import compressionMiddleware from "compression";
import { importRouterMiddleware, type MatchedRoute, type NodeMiddleware } from "@marko/run-adapter-node/middleware";

declare module "http" {
  interface IncomingMessage {
    route?: MatchedRoute
    myData: string
  }
}

let router: NodeMiddleware | undefined;

express()
  .use(importRouterMiddleware())
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use(async (req, res, next) => {
    if (!router) {
      const { routerMiddleware } = await import('@marko/run-adapter-node/middleware');
      router = routerMiddleware();
    }
    router(req, res, next)
  })
  .listen(process.env.PORT);

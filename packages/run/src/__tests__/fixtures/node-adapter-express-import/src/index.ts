import express from "express";
import compressionMiddleware from "compression";
import { importRouterMiddleware, type NodeMiddleware } from "@marko/run-adapter-node/middleware";

let router: NodeMiddleware | undefined;

express()
  .use(importRouterMiddleware())
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use(async (req, res, next) => {
    if (!router) {
      // This router middleware is imported dynamically to test that the `importRouterMiddleware` middleware
      // causes the router to be pulled in during the build insead of this middleware.
      const path = '@marko/run-adapter-node/middleware';
      const { routerMiddleware } = await import(/* @vite-ignore */path);
      router = routerMiddleware();
    }
    router!(req, res, next)
  })
  .listen(process.env.PORT);

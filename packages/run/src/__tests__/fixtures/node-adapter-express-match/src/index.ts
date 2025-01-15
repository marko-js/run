import { invokeMiddleware, type MatchedRoute,matchMiddleware } from "@marko/run-adapter-node/middleware";
import compressionMiddleware from "compression";
import express from "express";

declare module "http" {
  interface IncomingMessage {
    route?: MatchedRoute
    myData: string
  }
}

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use(matchMiddleware())
  .use((req, res, next) => {
    if (req.route) {
      req.myData = 'from express server'
    }
    next();
  })
  .use(invokeMiddleware())
  .listen(process.env.PORT);

import express from "express";
import compressionMiddleware from "compression";
import { matchMiddleware, invokeMiddleware, type MatchedRoute } from "@marko/run-adapter-node/middleware";

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

import express from "express";
import compressionMiddleware from "compression";
import { matchMiddleware, type MatchedRoute } from "@marko/run-adapter-node/middleware";

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
      req.route.invoke(req, res, next)
    } else {
      next();
    }
  })
  .listen(process.env.PORT);

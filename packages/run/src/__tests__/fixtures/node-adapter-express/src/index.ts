import express from "express";
import compressionMiddleware from "compression";
import { routerMiddleware } from "@marko/run-adapter-node/middleware";

declare module "http" {
  interface IncomingMessage {
    myData: string
  }
}

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use((req, _res, next) => {
    req.myData = 'from express server'
    next();
  })
  .use(routerMiddleware())
  .listen(process.env.PORT);

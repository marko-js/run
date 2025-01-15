import { routerMiddleware } from "@marko/run-adapter-node/middleware";
import compressionMiddleware from "compression";
import express from "express";

declare module "http" {
  interface IncomingMessage {
    myData: string
  }
}

process.env.TRUST_PROXY = "1";

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use((req, _res, next) => {
    req.headers['x-forwarded-proto'] = 'https';
    req.headers['x-forwarded-host'] = 'markojs.com';
    req.myData = 'from express server'
    next();
  })
  .use(routerMiddleware())
  .listen(process.env.PORT);

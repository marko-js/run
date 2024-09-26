import express from "express";
import compressionMiddleware from "compression";
import { routerMiddleware } from "@marko/run-adapter-node/middleware";

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use(routerMiddleware())
  .listen(process.env.PORT);

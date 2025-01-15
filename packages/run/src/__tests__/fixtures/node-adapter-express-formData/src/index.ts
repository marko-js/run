import { routerMiddleware } from "@marko/run-adapter-node/middleware";
import compressionMiddleware from "compression";
import express from "express";

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use(routerMiddleware())
  .listen(process.env.PORT);

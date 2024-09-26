import express from "express";
import bodyParser from 'body-parser';
import compressionMiddleware from "compression";
import { routerMiddleware } from "@marko/run-adapter-node/middleware";

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use(bodyParser.urlencoded({ extended: false }))
  .use(routerMiddleware())
  .listen(process.env.PORT);

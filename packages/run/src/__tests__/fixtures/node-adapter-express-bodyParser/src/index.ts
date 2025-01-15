import { routerMiddleware } from "@marko/run-adapter-node/middleware";
import bodyParser from 'body-parser';
import compressionMiddleware from "compression";
import express from "express";

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use(bodyParser.urlencoded({ extended: false }))
  .use(routerMiddleware())
  .listen(process.env.PORT);

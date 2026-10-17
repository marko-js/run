import { routerMiddleware } from "@marko/run-adapter-node/middleware";
import express from "express";

import { serverLabel } from "./label";

express()
  .use((_req, res, next) => {
    res.setHeader("x-server-label", serverLabel);
    next();
  })
  .use(routerMiddleware())
  .listen(process.env.PORT);

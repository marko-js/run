import { routerMiddleware } from "@marko/run-adapter-node/middleware";
import compressionMiddleware from "compression";
import express from "express";

import Page from "./other-routes/page.marko";

process.env.TRUST_PROXY = "1";

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("dist/public/assets"))
  .use(routerMiddleware())
  .use((req, res, next) => {
    if (req.url === '/') {
      Page.render({}, res);
    }
    next();
  })
  .listen(process.env.PORT);


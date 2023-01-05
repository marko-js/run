import express from "express";
import compressionMiddleware from "compression";
import { matchMiddleware } from "@marko/serve-adapter-node/middleware";

// @ts-expect-error
import metaRouterMiddleware from "meta-router/middleware/index.js"; 

const { PORT = 3000 } = process.env;

console.time("Start");

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("assets"))
  .use(matchMiddleware())
  .use((req, _res, next) => {
    const routeConfig = req.route?.config;

    if (routeConfig) {
      console.log("Matched route!!!");
    } else {
      console.log("No route matched");
    }

    next();
  })
  .use(metaRouterMiddleware.invokeHandler())
  .listen(PORT, () => {
    console.log("listening");
    console.timeEnd("Start");
    console.log(`Env: ${process.env.NODE_ENV}`);
    console.log(`Address: http://localhost:${PORT}`);
  });

import express from "express";
import compressionMiddleware from "compression";
import { routerMiddleware } from "@marko/serve-express";

const { NODE_ENV = "development", PORT = 3000 } = process.env;

console.time("Start");

express()
  .use(compressionMiddleware())
  .use("/assets", express.static("dist/assets"))
  .use(routerMiddleware())
  .listen(PORT, () => {
    console.log("listening");
    console.timeEnd("Start");
    console.log(`Env: ${NODE_ENV}`);
    console.log(`Address: http://localhost:${PORT}`);
  });

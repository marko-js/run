import { routerMiddleware } from "@marko/run-adapter-node/middleware";
import compressionMiddleware from "compression";
import express from "express";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const { NODE_ENV = "development", PORT = 3000 } = process.env;

console.time("Start");

express()
  .use(compressionMiddleware())
  .use("/assets", express.static(path.join(__dirname, "assets")))
  .use(routerMiddleware())
  .listen(PORT, () => {
    console.log("listening");
    console.timeEnd("Start");
    console.log(`Env: ${NODE_ENV}`);
    console.log(`Address: http://localhost:${PORT}`);
  });

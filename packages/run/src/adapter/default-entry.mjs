import createStaticServe from "serve-static";
import compression from "compression";
import { createServer } from "http";
import createMiddleware from "@marko/run/adapter/middleware";
import { router } from "@marko/run/router";

const { PORT = 3456 } = process.env;

const dir = process.cwd();
const middleware = createMiddleware(router);
const compress = compression({
  threshold: 500,
});
const staticServe = createStaticServe(dir, {
  index: false,
  immutable: true,
  maxAge: "365 days",
});

createServer((req, res) =>
  compress(req, res, () => 
  staticServe(req, res, () => middleware(req, res))
  )
).listen(PORT);

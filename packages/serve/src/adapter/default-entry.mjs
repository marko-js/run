import createStaticServe from "serve-static";
import { createServer } from "http";
import { createMiddleware } from "@hattip/adapter-node";
import { handler } from "@marko/serve";

const { PORT = 3456 } = process.env;

const dir = process.cwd();
const middleware = createMiddleware(handler);
const staticServe = createStaticServe(dir, {
  index: false,
  immutable: true,
  maxAge: "365 days",
});

createServer((req, res) =>
  staticServe(req, res, () => middleware(req, res))
).listen(PORT);

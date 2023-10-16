import createStaticServe from "serve-static";
import compression from "compression";
import { createServer } from "http";
import { createMiddleware } from "@marko/run/adapter/middleware";
import { fetch } from "@marko/run/router";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
const __dirname = dirname(fileURLToPath(import.meta.url));

const { PORT = 3456 } = process.env;

const middleware = createMiddleware(fetch);
const compress = compression({
  flush: zlib.constants.Z_PARTIAL_FLUSH,
  threshold: 500,
});
const staticServe = createStaticServe(__dirname, {
  index: false,
  immutable: true,
  maxAge: "365 days",
});

const server = createServer((req, res) =>
  compress(req, res, () => 
  staticServe(req, res, () => middleware(req, res))
  )
).listen(PORT);


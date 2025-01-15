import { createMiddleware } from "@marko/run/adapter/middleware";
import { fetch } from "@marko/run/router";
import compression from "compression";
import { createServer } from "http";
import { dirname } from "path";
import createStaticServe from "serve-static";
import { fileURLToPath } from "url";
import zlib from "zlib";
const __dirname = dirname(fileURLToPath(import.meta.url));

const { PORT = 3000 } = process.env;

const middleware = createMiddleware(fetch);
const compress = compression({
  flush: zlib.constants.Z_PARTIAL_FLUSH,
  threshold: 500,
});

const servePublic = createStaticServe(`${__dirname}/public`, {
  index: false,
  redirect: false,
  maxAge: "10 minutes",
});

const serveAssets = createStaticServe(`${__dirname}/public/assets`, {
  index: false,
  redirect: false,
  immutable: true,
  fallthrough: false,
  maxAge: "365 days",
});

createServer((req, res) =>
  compress(req, res, () => {
    if (req.url.startsWith("/assets/")) {
      req.url = req.url.slice(7);
      serveAssets(req, res, () => {
        res.statusCode = 404;
        res.end();
      });
    } else {
      servePublic(req, res, () => middleware(req, res));
    }
  }),
).listen(PORT);

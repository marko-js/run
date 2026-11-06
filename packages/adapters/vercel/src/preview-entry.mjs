import { createMiddleware } from "@marko/run/adapter/middleware";
import compression from "compression";
import fs from "fs";
import { createServer } from "http";
import path from "path";
import createStaticServe from "serve-static";
import { pathToFileURL } from "url";
import zlib from "zlib";

const { PORT = 3000 } = process.env;

// Emulates the routes in the generated `config.json`: static files first, then
// the function. `vercel dev` can't serve prebuilt output, so this runs instead.
const outputDir = path.resolve(".vercel", "output");
const funcDir = path.join(outputDir, "functions", "index.func");
const funcConfig = path.join(funcDir, ".vc-config.json");
const staticDir = path.join(outputDir, "static");

if (!fs.existsSync(funcConfig)) {
  console.error(
    `Vercel build output not found at '${outputDir}'. Run \`marko-run build\` before previewing.`,
  );
  process.exit(1);
}

const funcEntry = path.join(
  funcDir,
  JSON.parse(fs.readFileSync(funcConfig, "utf8")).handler,
);

const compress = compression({
  flush: zlib.constants.Z_PARTIAL_FLUSH,
  threshold: 500,
});

// Headers the generated `config.json` attaches to paths, such as the
// immutable caching of hashed assets.
const headerRoutes = JSON.parse(
  fs.readFileSync(path.join(outputDir, "config.json"), "utf8"),
).routes.filter((route) => route.src && route.headers && route.continue);

const serveStatic = createStaticServe(staticDir, {
  index: false,
  redirect: false,
  cacheControl: false,
  setHeaders(res) {
    res.setHeader("cache-control", "public, max-age=0, must-revalidate");
    const { pathname } = new URL(res.req.url, "http://localhost");
    for (const route of headerRoutes) {
      if (new RegExp(route.src).test(pathname)) {
        for (const [key, value] of Object.entries(route.headers)) {
          res.setHeader(key, value);
        }
      }
    }
  },
});

import(pathToFileURL(funcEntry).href)
  .then(({ default: handler }) => {
    const middleware = toMiddleware(handler);
    createServer((req, res) =>
      compress(req, res, () =>
        serveStatic(req, res, () =>
          // The function handles everything itself; `next` only runs when it
          // declines the request (unmatched route) or bubbles an error.
          middleware(req, res, (err) => {
            if (res.writableEnded) {
              return;
            }
            if (err) {
              console.error(err);
              res.statusCode = 500;
              res.end("Internal Server Error");
            } else {
              res.statusCode = 404;
              res.end("Not Found");
            }
          }),
        ),
      ),
    ).listen(PORT, () => {
      console.log(`Serving Vercel build output at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to load Vercel function entry:", err);
    process.exit(1);
  });

/** Calls the function's `fetch` the way Vercel does: with the request alone. */
function toMiddleware(handler) {
  if (typeof handler?.fetch !== "function") {
    throw new Error(
      "The function's default export must be an object with a `fetch(request)` method.",
    );
  }
  return createMiddleware(async (request) => handler.fetch(request));
}

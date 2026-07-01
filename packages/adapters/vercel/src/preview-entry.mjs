import compression from "compression";
import fs from "fs";
import { createServer } from "http";
import path from "path";
import createStaticServe from "serve-static";
import { pathToFileURL } from "url";
import zlib from "zlib";

const { PORT = 3000 } = process.env;

// `marko-run preview` spawns this entry with the app root as the working
// directory, where the build wrote the Vercel Build Output API directory.
// `vercel dev` cannot serve that output — it rebuilds from source and removes
// `.vercel/output` — so preview emulates the two rules the adapter's generated
// `config.json` describes: serve a matching static asset if one exists (the
// `filesystem` handler), otherwise invoke the function.
const outputDir = path.resolve(".vercel", "output");
const funcEntry = path.join(outputDir, "functions", "index.func", "index.js");
const staticDir = path.join(outputDir, "static");

if (!fs.existsSync(funcEntry)) {
  console.error(
    `Vercel build output not found at '${outputDir}'. Run \`marko-run build\` before previewing.`,
  );
  process.exit(1);
}

const compress = compression({
  flush: zlib.constants.Z_PARTIAL_FLUSH,
  threshold: 500,
});

const servePublic = createStaticServe(staticDir, {
  index: false,
  redirect: false,
  maxAge: "10 minutes",
});

const serveAssets = createStaticServe(`${staticDir}/assets`, {
  index: false,
  redirect: false,
  immutable: true,
  fallthrough: false,
  maxAge: "365 days",
});

import(pathToFileURL(funcEntry).href).then(({ default: middleware }) => {
  createServer((req, res) =>
    compress(req, res, () => {
      if (req.url.startsWith("/assets/")) {
        req.url = req.url.slice(7);
        serveAssets(req, res, () => {
          res.statusCode = 404;
          res.end();
        });
      } else {
        servePublic(req, res, () =>
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
        );
      }
    }),
  ).listen(PORT, () => {
    console.log(`Serving Vercel build output at http://localhost:${PORT}`);
  });
});

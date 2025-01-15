import { exec } from "child_process";
import compression from "compression";
import { createServer } from "http";
import { dirname } from "path";
import path from "path";
import createStaticServe from "serve-static";
import { fileURLToPath } from "url";
import zlib from "zlib";

const { PORT = 3000 } = process.env;
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = path.join(__dirname, "..");
const appDir = path.join(packageDir, ".app");
const entryFile = path.join(packageDir, "src", "index.ts");

let buildPromise = null;
async function build() {
  return (buildPromise ??= new Promise((resolve, reject) => {
    exec(
      `marko-run build --output ${appDir} ${entryFile}`,
      { cwd: packageDir, env: { ...process.env, MR_EXPLORER: "false" } },
      async (error) => {
        if (error) {
          reject(error);
        }
        ({ default: middleware } = await import(
          path.join(appDir, "index.mjs")
        ));
        resolve();
      },
    );
  }));
}

let middleware = (req, res) => {
  build().then(() => middleware(req, res));
};

const compress = compression({
  flush: zlib.constants.Z_PARTIAL_FLUSH,
  threshold: 500,
});
const servePublic = createStaticServe(`${appDir}/public`, {
  index: false,
  redirect: false,
  maxAge: "10 minutes",
});

const serveAssets = createStaticServe(`${appDir}/public/assets`, {
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

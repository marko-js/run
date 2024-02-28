import createStaticServe from "serve-static";
import compression from "compression";
import { createServer } from "http";
import { dirname } from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";
import { exec } from "child_process";
import path from "path";
import { IncomingMessage } from "http";
import { ServerResponse } from "http";

const { PORT = 3000 } = process.env;
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = path.join(__dirname, "..");
const entryFile = path.join(packageDir, "src", "index.ts");
const distDir = path.join(packageDir, ".app");

let buildPromise: Promise<void> | null = null;
async function build() {
  return (buildPromise ??= new Promise<void>((resolve, reject) => {
    exec(
      `marko-run build --output ${distDir} ${entryFile}`,
      { cwd: packageDir, env: { ...process.env, MR_EXPLORER: "false" } },
      async (error) => {
        if (error) {
          reject(error);
        }
        ({ default: middleware } = await import(
          path.join(distDir, "index.mjs")
        ));
        resolve();
      },
    );
  }));
}

let middleware = (req: IncomingMessage, res: ServerResponse) => {
  build().then(() => middleware(req, res));
};

const compress = compression({
  flush: zlib.constants.Z_PARTIAL_FLUSH,
  threshold: 500,
});
const staticServe = createStaticServe(__dirname, {
  index: false,
  immutable: true,
  maxAge: "365 days",
});

createServer((req, res) =>
  compress(req as any, res as any, () =>
    staticServe(req, res, () => middleware(req, res)),
  ),
).listen(PORT);

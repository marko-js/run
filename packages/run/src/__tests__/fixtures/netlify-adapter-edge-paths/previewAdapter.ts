import { createMiddleware } from "@marko/run/adapter/middleware";
import type { Adapter } from "@marko/run/vite";
import netlifyAdapter from "@marko/run-adapter-netlify";
import fs from "fs";
import { createServer } from "http";
import type { AddressInfo } from "net";
import path from "path";

// Serves the built edge function the way Netlify would -- the real preview
// needs the Netlify CLI and Deno. The function runs for the paths its config
// selects; a skipped function and `next()` both read the published directory.
export default (): Adapter => ({
  ...netlifyAdapter({ edge: true }),
  name: "netlify-edge-preview-adapter",

  async startPreview({ options: { dir, port } }) {
    const publicDir = path.join(dir, "public");
    const { default: edge, config } = (await import(
      `file://${path.join(dir, "index.mjs")}`
    )) as { default: EdgeFunction; config: EdgeConfig };

    async function serveStatic(request: Request) {
      const file = path.join(publicDir, new URL(request.url).pathname);
      if (
        file.startsWith(publicDir) &&
        fs.statSync(file, { throwIfNoEntry: false })?.isFile()
      ) {
        return new Response(fs.readFileSync(file), {
          headers: {
            "content-type":
              contentTypes[path.extname(file)] || "application/octet-stream",
          },
        });
      }
      return new Response(null, { status: 404 });
    }

    const middleware = createMiddleware(async (request) =>
      selects(config, new URL(request.url).pathname)
        ? edge(request, { next: () => serveStatic(request) })
        : serveStatic(request),
    );
    const server = createServer((req, res) =>
      middleware(req, res, () => {
        res.writeHead(404);
        res.end();
      }),
    );

    return new Promise((resolve) => {
      const listener = server.listen(port, () => {
        resolve({
          port: (listener.address() as AddressInfo).port,
          close() {
            listener.close();
          },
        });
      });
    });
  },
});

// The pieces of Netlify's contract this stands in for: the declaration that
// picks which paths run the function, and the `next()` the entry calls.
interface EdgeConfig {
  path?: string | string[];
  pattern?: string | string[];
  excludedPath?: string | string[];
}
type EdgeFunction = (
  request: Request,
  context: { next(): Promise<Response> },
) => Promise<Response>;

// Enough of the declaration syntax to cover what the entry declares: a
// literal path, `:name` for one segment, and `*` for the rest. An excluded
// path keeps the platform's own handling whichever declaration matched it.
function selects(config: EdgeConfig, pathname: string) {
  if (toMatchers(config.excludedPath).some((it) => it.test(pathname))) {
    return false;
  }
  return [
    ...toArray(config.pattern).map((pattern) => new RegExp(pattern)),
    ...toMatchers(config.path),
  ].some((it) => it.test(pathname));
}

function toMatchers(paths: string | string[] | undefined) {
  return toArray(paths).map(
    (declared) =>
      new RegExp(
        `^${declared
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/:[^/]+/g, "[^/]+")
          .replace(/\*/g, ".*")}$`,
      ),
  );
}

function toArray(value: string | string[] | undefined) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

const contentTypes: Record<string, string> = {
  ".bin": "application/octet-stream",
  ".css": "text/css",
  ".html": "text/html;charset=UTF-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mjs": "text/javascript",
  ".svg": "image/svg+xml",
  ".txt": "text/plain;charset=UTF-8",
};

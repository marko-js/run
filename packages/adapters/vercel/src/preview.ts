import type { SpawnedServer } from "@marko/run/adapter";
import fs from "fs";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { Socket } from "net";
import path from "path";
import { pathToFileURL } from "url";

/** A Node.js request listener, as exported by the generated function. */
type NodeHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void | Promise<void>;

export interface PreviewServerOptions {
  /** The `.vercel/output` Build Output API directory produced by the build. */
  outputDir: string;
  /** Port to listen on. */
  port: number;
}

// Content types for the handful of extensions a static build emits. Kept as a
// small map rather than a dependency to match the adapter's zero-dep style.
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

/**
 * Serve a built `.vercel/output` directory locally, without the Vercel CLI.
 *
 * `vercel dev` cannot serve the Build Output API — it rebuilds from source and
 * removes `.vercel/output`. So preview emulates the two rules the adapter's
 * generated `config.json` describes: serve a matching static asset if one
 * exists (the `filesystem` handler), otherwise invoke the function.
 */
export async function startPreviewServer({
  outputDir,
  port,
}: PreviewServerOptions): Promise<SpawnedServer> {
  const staticDir = path.join(outputDir, "static");
  const funcEntry = path.join(outputDir, "functions", "index.func", "index.js");

  if (!fs.existsSync(funcEntry)) {
    throw new Error(
      `Vercel build output not found at '${outputDir}'. Run \`marko-run build\` before previewing.`,
    );
  }

  const handler: NodeHandler = (await import(pathToFileURL(funcEntry).href))
    .default;

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) {
        res.statusCode = 500;
      }
      if (!res.writableEnded) {
        res.end("Internal Server Error");
      }
    });
  });

  // Track open sockets so `close()` can terminate keep-alive connections;
  // otherwise `server.close()` waits indefinitely for idle clients to hang up.
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const pathname = (req.url || "/").split(/[?#]/, 1)[0];
    const staticFile = await resolveStaticFile(staticDir, pathname);
    if (staticFile) {
      return serveStaticFile(staticFile, res);
    }

    // The generated function handles everything itself; `next` only runs
    // when it declines the request (unmatched route) or bubbles an error.
    return handler(req, res, (err) => {
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
    });
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return {
    port,
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        for (const socket of sockets) {
          socket.destroy();
        }
      });
    },
  };
}

/**
 * Resolve a request path to a file inside the static directory, mirroring
 * Vercel's `filesystem` handler: exact match, then `.html`, then a directory
 * `index.html`. Returns `undefined` when nothing matches.
 */
async function resolveStaticFile(staticDir: string, pathname: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined; // malformed percent-encoding
  }

  const candidates =
    decoded === "" || decoded.endsWith("/")
      ? [path.join(decoded, "index.html")]
      : [decoded, `${decoded}.html`, path.join(decoded, "index.html")];

  for (const candidate of candidates) {
    const filePath = path.join(staticDir, candidate);
    // Guard against `..` escaping the static directory.
    if (filePath !== staticDir && !filePath.startsWith(staticDir + path.sep)) {
      continue;
    }
    try {
      if ((await fs.promises.stat(filePath)).isFile()) {
        return filePath;
      }
    } catch {
      // Not found — try the next candidate.
    }
  }

  return undefined;
}

function serveStaticFile(filePath: string, res: ServerResponse) {
  const type = contentTypes[path.extname(filePath).toLowerCase()];
  if (type) {
    res.setHeader("content-type", type);
  }
  return new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    res.on("close", resolve);
    stream.pipe(res);
  });
}

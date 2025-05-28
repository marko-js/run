import type { Fetch } from "@marko/run";
import baseAdapter from "@marko/run/adapter";
import type {
  Adapter,
  AdapterConfig,
  Options as MarkoRunOptions,
  Route,
} from "@marko/run/vite";
import { getAvailablePort, loadEnv, spawnServer } from "@marko/run/vite";
import compression from "compression";
import fs from "fs/promises";
import { createServer } from "http";
import type { AddressInfo } from "net";
import path from "path";
import sirv from "sirv";
import { Pool } from "undici";
import { fileURLToPath, pathToFileURL } from "url";
import zlib from "zlib";

import createCrawler from "./crawler";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "default-entry");

export interface Options {
  urls?: string[] | ((routes: Route[]) => string[] | Promise<string[]>);
}

export default function staticAdapter(options: Options = {}): Adapter {
  const { startDev } = baseAdapter();
  let adapterConfig!: AdapterConfig;
  let markoRunOptions: MarkoRunOptions;
  return {
    name: "static-adapter",

    configure(config) {
      adapterConfig = config;
    },

    pluginOptions(options) {
      return (markoRunOptions = options);
    },

    getEntryFile() {
      return defaultEntry;
    },

    startDev(event) {
      return startDev!({
        ...event,
        entry: event.entry === defaultEntry ? undefined : event.entry,
      });
    },

    startPreview({ options }) {
      const { dir, port, envFile } = options;
      envFile && loadEnv(envFile);

      const compress = compression({
        flush: zlib.constants.Z_PARTIAL_FLUSH,
        threshold: 500,
      });
      const staticServe = sirv(path.join(dir, "public"), {
        extensions: ["html"],
        setHeaders(res, path) {
          if (path === "/404") {
            res.statusCode = 404;
          }
        },
      });
      const server = createServer((req, res) =>
        compress(req as any, res as any, () =>
          staticServe(req, res, () => {
            if (req.url === "/404") {
              res.writeHead(404);
            } else {
              res.writeHead(302, undefined, {
                location: "/404",
              });
            }
            res.end();
          }),
        ),
      );

      return new Promise((resolve) => {
        const listener = server.listen(port, () => {
          const address = listener.address() as AddressInfo;
          console.log(
            `Preview server started: http://localhost:${address.port}`,
          );
          resolve({
            port: address.port,
            close() {
              listener.close();
            },
          });
        });
      });
    },

    async buildEnd({ routes, builtEntries, sourceEntries }) {
      const { envFile } = adapterConfig;

      const pathsToVisit: string[] = [];
      for (const route of routes.list) {
        if (!route.path.params || !Object.keys(route.path.params).length) {
          pathsToVisit.push(route.path.path);
        }
      }
      if (typeof options.urls === "function") {
        pathsToVisit.push(...(await options.urls(routes.list)));
      } else if (options.urls) {
        pathsToVisit.push(...options.urls);
      }

      const defaultEntry = await this.getEntryFile!();

      const trailingSlash =
        markoRunOptions.trailingSlashes === "RedirectWith" ||
        markoRunOptions.trailingSlashes === "RewriteWith";

      if (sourceEntries[0] === defaultEntry) {
        envFile && (await loadEnv(envFile));
        const fetch: Fetch = (await import(pathToFileURL(builtEntries[0]).href))
          .fetch;
        const crawler = createCrawler(
          async (request) => {
            const response = await fetch(request, {});
            return response || new Response(null, { status: 404 });
          },
          {
            out: path.join(path.dirname(builtEntries[0]), "public"),
            notFoundPath: routes.special["404"]
              ? "404" + (trailingSlash ? "/" : "")
              : undefined,
          },
        );
        await crawler.crawl(pathsToVisit);
      } else {
        const port = await getAvailablePort();
        const origin = `http://localhost:${port}`;
        const client = new Pool(origin);

        const server = await spawnServer(
          `node ${builtEntries[0]}`,
          [],
          port,
          envFile,
        );
        const crawler = createCrawler(
          async (request) => {
            const url = new URL(request.url, origin);
            const headers: Record<string, string> = {};
            request.headers.forEach((value, key) => {
              headers[key] = value;
            });
            const responseData = await client.request({
              path: url.pathname + url.search,
              method: request.method as any,
              signal: request.signal,
              headers,
            });
            return new Response(responseData.body as any, {
              status: responseData.statusCode,
              headers: responseData.headers as Record<string, string>,
            });
          },
          {
            origin,
            notFoundPath: routes.special["404"]
              ? "404" + (trailingSlash ? "/" : "")
              : undefined,
          },
        );

        try {
          await crawler.crawl(pathsToVisit);
        } finally {
          await client.close();
          server.close();
        }
      }

      for (const file of builtEntries) {
        await fs.rm(file, { maxRetries: 5 }).catch(() => {});
      }
    },
  };
}

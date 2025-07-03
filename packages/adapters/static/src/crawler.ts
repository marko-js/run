import fs from "fs";
import { WritableStream as Parser } from "htmlparser2/WritableStream";
import nodePath from "path";

const ignoredRels = new Set(["nofollow", "enclosure", "external"]);
const contentType = "text/html";

export interface Options {
  out?: string;
  origin?: string;
  notFoundPath?: string;
}

export interface Crawler {
  crawl(paths: string[]): Promise<void>;
}

export default function createCrawler(
  makeRequest: (request: Request) => Promise<Response>,
  opts: Options = {},
): Crawler {
  const origin = opts.origin || `http://localhost`;
  const out = nodePath.resolve(opts.out || "dist");
  const notFoundPath =
    opts.notFoundPath && resolvePath(opts.notFoundPath, origin)!;
  let seen: Set<string>;
  let queue: Promise<void>[];
  let pending: Promise<any> | undefined;

  async function visit(path: string) {
    const parser = new Parser({
      onopentag(name, attrs) {
        const href = getTagHref(name, attrs);
        const path = href && resolvePath(href, origin);

        if (path !== undefined && !seen.has(path)) {
          seen.add(path);
          queue.push(visit(path));
        }
      },
    });

    const abortController = new AbortController();
    let pageWriter: fs.WriteStream | undefined;
    try {
      const url = new URL(path, origin);
      const req = new Request(url, {
        method: "GET",
        signal: abortController.signal as any,
        headers: { accept: contentType },
      });

      const res = await makeRequest(req);
      const validContentType = !!res.headers
        .get("content-type")
        ?.includes(contentType);

      let redirect: string | undefined;

      switch (res.status) {
        case 200:
          if (!validContentType) {
            abortController.abort();
            return;
          }
          break;
        case 404:
          if (!notFoundPath || !validContentType) {
            abortController.abort();
            return;
          }
          if (path.endsWith("/")) {
            path = path.slice(0, -1);
          }
          break;
        case 301:
        case 302:
        case 307:
        case 308: {
          const location = res.headers.get("location") || "";
          redirect = resolvePathWithHash(location, origin);

          if (redirect) {
            const redirectPath = resolvePath(location, origin);
            if (redirectPath && !seen.has(redirectPath)) {
              seen.add(redirectPath);
              queue.push(visit(redirectPath));
            }
          } else {
            redirect = location;
          }
          break;
        }
        default: {
          abortController.abort();
          console.warn(
            `Status code ${res.status} was while crawling: '${path}'`,
          );
          return;
        }
      }

      const htmlFilePath = nodePath.join(
        out,
        path.endsWith("/") ? path + "index.html" : path + ".html",
      );

      fs.mkdirSync(nodePath.dirname(htmlFilePath), { recursive: true });
      pageWriter = fs.createWriteStream(htmlFilePath);

      if (redirect) {
        if (path !== notFoundPath) {
          const html = `<!DOCTYPE html><meta http-equiv=Refresh content="0;url=${redirect.replace(/"/g, "&#40;")}">`;
          pageWriter.write(html);
        }
      } else if (res.body) {
        await res.body.pipeTo(
          new WritableStream({
            write(data) {
              pageWriter!.write(data);
              parser.write(data);
            },
          }),
        );
      }
    } finally {
      pageWriter?.end();
      parser.end();
    }
  }

  return {
    async crawl(paths: string[] = ["/"]) {
      if (pending) {
        await pending;
      }

      const startPaths = paths
        .map((path) => resolvePath(path, origin))
        .concat(notFoundPath)
        .filter(Boolean) as string[];

      seen = new Set(startPaths);

      try {
        queue = startPaths.map(visit);

        while (queue.length) {
          pending = Promise.all(queue);
          queue = [];
          await pending;
        }
      } finally {
        pending = undefined;
      }
    },
  };
}

function getTagHref(tagName: string, attrs: Record<string, string>) {
  switch (tagName) {
    case "a":
      if (attrs.href && !(attrs.download || ignoredRels.has(attrs.rel))) {
        return attrs.href;
      }
      break;
    case "link":
      if (attrs.href) {
        switch (attrs.rel) {
          case "alternate":
          case "author":
          case "canonical":
          case "help":
          case "license":
          case "next":
          case "prefetch":
          case "prerender":
          case "prev":
          case "search":
          case "tag":
            return attrs.href;
          case "preload":
            if (attrs.as === "document") {
              return attrs.href;
            }
            break;
        }
      }
      break;
    case "iframe":
      return attrs.src;
  }
}

function resolveUrl(href: string, origin: string) {
  try {
    const url = new URL(href, origin);
    if (url.origin === origin) {
      return url;
    }
  } catch {
    return undefined;
  }
}

function resolvePath(href: string, origin: string) {
  const url = resolveUrl(href, origin);
  return url && url.pathname + url.search;
}

function resolvePathWithHash(href: string, origin: string) {
  const url = resolveUrl(href, origin);
  return url && url.pathname + url.search + url.hash;
}

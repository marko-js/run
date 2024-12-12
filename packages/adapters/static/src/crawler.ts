import fs from "fs";
import nodePath from "path";
import { WritableStream as Parser } from "htmlparser2/lib/WritableStream";

const noop = () => {};
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
  opts: Options = {}
): Crawler {
  const origin = opts.origin || `http://localhost`;
  const out = nodePath.resolve(opts.out || "dist");
  const notFoundPath = resolvePath(opts.notFoundPath || "/404/", origin)!;
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

    const dirname = nodePath.join(out, path);
    const abortController = new AbortController();
    let fsWriter: fs.WriteStream | undefined;

    try {
      const url = new URL(path, origin);
      const req = new Request(url, {
        method: "GET",
        signal: abortController.signal as any,
        headers: { accept: contentType },
      });

      const res = await makeRequest(req);
      const validContentType = !!res.headers.get("content-type")?.includes(contentType);

      let redirect: string | undefined;

      switch (res.status) {
        case 200:
          if (!validContentType) {
            abortController.abort();
            return;
          }
          break;
        case 404:
          if (path !== notFoundPath) {
            redirect = origin + notFoundPath;
          } else if (!validContentType) {
            abortController.abort();
            return;
          }
          break;
        case 301: {
          const location = res.headers.get("location") || "";
          redirect = resolvePathWithHash(location, origin);

          if (redirect) {
            const redirectPath = resolvePath(location, origin);
            if (redirectPath && !seen.has(redirectPath)) {
              seen.add(redirectPath);
              queue.push(visit(redirectPath));
            }
          } else {
            redirect = location
          }
          break;
        }
        default: {
          abortController.abort();
          console.warn(`Status code ${res.status} was while crawling: '${path}'`);
          return;
        }
      }

      await fs.promises.mkdir(dirname, { recursive: true }).catch(noop);
      fsWriter = fs.createWriteStream(nodePath.join(dirname, "index.html"));

      if (redirect) {
        abortController.abort();
        fsWriter.write(
          `<!DOCTYPE html><meta http-equiv=Refresh content="0;url=${redirect.replace(
            /"/g,
            "&#40;"
          )}">`
        );
      } else {
        const writable = new WritableStream({
          write(data) {
            fsWriter!.write(data);
            parser.write(data);
          },
        });

        if (res.body) {
          await res.body.pipeTo(writable);
        }
      }
    } finally {
      fsWriter?.end();
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
        .filter(Boolean)
        .concat(notFoundPath) as string[];

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
      let { pathname } = url;
      const lastChar = pathname.length - 1;
      if (pathname[lastChar] !== "/") {
        url.pathname += '/'
      }
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

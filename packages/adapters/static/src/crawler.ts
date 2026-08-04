import fs from "fs";
import { WritableStream as Parser } from "htmlparser2/WritableStream";
import nodePath from "path";
import { finished } from "stream/promises";

const ignoredRels = new Set(["nofollow", "enclosure", "external"]);

export interface Options {
  out?: string;
  origin?: string;
  notFoundPath?: string;
}

/** The outcome of crawling a single path. */
export interface VisitResult {
  /** The path that was crawled. */
  path: string;
  /** The status the path answered with. */
  status: number;
  /**
   * Whether the path was crawled without error. `false` means a page was
   * expected here and failed to render, so nothing was written for it. A
   * successful visit may still write no file — a redirect the crawler cannot
   * resolve, or a success status with no page to prerender.
   */
  ok: boolean;
  /** Absolute path of the file written, when the visit produced one. */
  file?: string;
}

/** The visits of a crawl, bucketed by outcome. */
export interface CrawlResults {
  /** Paths crawled without error, including those with nothing to prerender. */
  success: VisitResult[];
  /** Paths that answered with a redirect. */
  redirect: VisitResult[];
  /** Paths that answered `404`, other than the crawled 404 page itself. */
  notFound: VisitResult[];
  /** Paths a page was expected at that failed to render. */
  failure: VisitResult[];
}

export interface Crawler {
  crawl(paths: string[]): Promise<CrawlResults>;
}

export default function createCrawler(
  makeRequest: (request: Request) => Promise<Response>,
  opts: Options = {},
): Crawler {
  const origin = new URL(opts.origin || `http://localhost`);
  const out = nodePath.resolve(opts.out || "dist");
  const notFoundPath =
    opts.notFoundPath && resolvePath(opts.notFoundPath, origin)!;
  let seen: Set<string>;
  let queue: Promise<VisitResult>[];
  let pending: Promise<any> | undefined;

  async function visit(path: string): Promise<VisitResult> {
    const url = new URL(path, origin);
    const parser = new Parser({
      onopentag(name, attrs) {
        const href = getTagHref(name, attrs);
        // Relative to the page it was found on, not the origin: `./sibling` on
        // /docs/reference/language is /docs/reference/sibling, not /sibling.
        const found = href && resolvePath(href, url);

        if (found !== undefined && !seen.has(found)) {
          seen.add(found);
          queue.push(visit(found));
        }
      },
    });

    const abortController = new AbortController();
    let pageWriter: fs.WriteStream | undefined;
    try {
      const req = new Request(url, {
        method: "GET",
        signal: abortController.signal as any,
        headers: { accept: "text/html" },
      });

      const res = await makeRequest(req);
      const status = res.status;
      const htmlContentType = !!res.headers
        .get("content-type")
        ?.includes("text/html");

      let redirect: string | undefined;

      let filePath = nodePath.join(
        out,
        path.endsWith("/") ? path + "index.html" : path + ".html",
      );
      switch (res.status) {
        case 200:
          if (!htmlContentType) {
            if (/\.\w+$/.test(path)) {
              filePath = nodePath.join(out, path);
            } else {
              abortController.abort();
              return { path, status, ok: true };
            }
          }
          break;
        case 404:
          if (!notFoundPath || !htmlContentType) {
            abortController.abort();
            return { path, status, ok: true };
          }
          if (path.endsWith("/")) {
            path = path.slice(0, -1);
          }
          break;
        case 301:
        case 302:
        case 307:
        case 308: {
          const location = res.headers.get("location")?.trim();
          if (!location) {
            abortController.abort();
            return { path, status, ok: true };
          }

          redirect = resolvePathWithHash(location, url);

          if (redirect) {
            const redirectPath = resolvePath(location, url);
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
            `Received status code ${status} while crawling: '${path}'`,
          );
          // Nothing is written for this path either way. Only an error status
          // means a page was expected here and failed to render; a non-200
          // success (the 204 a handler-only route falls back to, say) simply
          // has nothing to prerender, which is not a build failure.
          return { path, status, ok: status < 400 };
        }
      }

      fs.mkdirSync(nodePath.dirname(filePath), { recursive: true });
      pageWriter = fs.createWriteStream(filePath);

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

      return { path, status, ok: true, file: filePath };
    } finally {
      parser.end();
      if (pageWriter) {
        pageWriter.end();
        await finished(pageWriter);
      }
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

      const results: CrawlResults = {
        success: [],
        redirect: [],
        notFound: [],
        failure: [],
      };
      try {
        queue = startPaths.map(visit);

        while (queue.length) {
          pending = Promise.all(queue);
          queue = [];
          // Bucketed one at a time: spreading a wave into `push` would cap the
          // number of paths a single wave can carry at the engine's argument
          // limit.
          for (const result of await pending) {
            const { ok, status, path } = result;
            if (!ok) {
              results.failure.push(result);
            } else if (status >= 300 && status < 400) {
              results.redirect.push(result);
            } else if (
              // The 404 page is seeded by the crawl itself and answers 404 by
              // design, so it prerendered like any other page rather than
              // pointing nowhere. `visit` trims the trailing slash a 404 path
              // may carry, so the configured path is matched both with and
              // without one.
              status === 404 &&
              path !== notFoundPath &&
              `${path}/` !== notFoundPath
            ) {
              results.notFound.push(result);
            } else {
              results.success.push(result);
            }
          }
        }
      } finally {
        pending = undefined;
      }

      const { success, redirect, notFound, failure } = results;
      const visited =
        success.length + redirect.length + notFound.length + failure.length;

      // A 404 does not fail the build — with a 404 page configured the crawler
      // even writes one for that path — but it is nearly always a link pointing
      // at a page that is gone, so those paths are listed and not just counted.
      console.log(
        `Crawled ${plural(visited, "path")}: ${success.length} successful, ` +
          `${plural(redirect.length, "redirect")}, ${notFound.length} not found, ` +
          `${plural(failure.length, "failure")}` +
          (notFound.length
            ? `\nPaths that answered 404:\n` +
              notFound.map(({ path }) => `  ${path}`).join("\n")
            : ""),
      );

      // A failed path writes no file, so finishing green here would ship a
      // site with that page missing. Reported together rather than failing on
      // the first one, since paths are crawled concurrently and one broken
      // route should not hide the rest.
      if (failure.length) {
        throw new Error(
          `Static build failed: ${plural(failure.length, "route")} did not render and ${
            failure.length === 1 ? "was" : "were"
          } left out of the build output.\n` +
            failure.map(({ status, path }) => `  ${status} ${path}`).join("\n"),
        );
      }

      return results;
    },
  };
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function getTagHref(tagName: string, attrs: Record<string, string>) {
  switch (tagName) {
    case "a":
      // `download` on its own parses to an empty string, so presence is what
      // decides here: a truthiness check only ever skipped `download="name"`.
      if (attrs.href && attrs.download == null && !hasIgnoredRel(attrs.rel)) {
        return attrs.href;
      }
      break;
    case "link":
      if (attrs.href) {
        // `rel` is a token list, so each token is matched on its own: a switch
        // on the whole attribute misses `rel="alternate stylesheet"`.
        for (const rel of relTokens(attrs.rel)) {
          switch (rel) {
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
      }
      break;
    case "iframe":
      return attrs.src;
  }
}

function hasIgnoredRel(rel: string | undefined) {
  for (const value of relTokens(rel)) {
    if (ignoredRels.has(value)) {
      return true;
    }
  }

  return false;
}

function relTokens(rel: string | undefined) {
  return rel ? rel.split(/\s+/) : [];
}

/**
 * `base` is the page a link was found on, so that a relative href resolves the
 * way a browser would. Links off-origin are skipped.
 */
function resolveUrl(href: string, base: URL) {
  try {
    const url = new URL(href, base);
    if (url.origin === base.origin) {
      return url;
    }
  } catch {
    return undefined;
  }
}

function resolvePath(href: string, base: URL) {
  const url = resolveUrl(href, base);
  return url && url.pathname + url.search;
}

function resolvePathWithHash(href: string, base: URL) {
  const url = resolveUrl(href, base);
  return url && url.pathname + url.search + url.hash;
}

import { defaultNormalizer, defaultSerializer } from "@marko/fixture-snapshots";
import { diffLines } from "diff";
import fs from "fs";
import { JSDOM } from "jsdom";
import snap from "mocha-snap";
import { createRequire } from "module";
import path from "path";
import * as playwright from "playwright";
import { fileURLToPath } from "url";

import * as cli from "../cli/commands";
import type { Options } from "../vite";
import { SpawnedServer, waitForServer } from "../vite/utils/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();

// https://github.com/esbuild-kit/tsx/issues/113
const { toString } = Function.prototype;
Function.prototype.toString = function () {
  return toString.call(this).replace(/\b__name\(([^,]+),[^)]+\)/g, "$1");
};

declare global {
  const page: playwright.Page;
  namespace NodeJS {
    interface Global {
      page: playwright.Page;
    }
  }
}

declare namespace globalThis {
  let page: playwright.Page;
}

declare let __loading__: Promise<void> | undefined;

export type StepContext = {
  page: playwright.Page;
  response: playwright.Response;
};
export type Step = (context: StepContext) => Promise<unknown> | unknown;
export type Assert = (
  page: playwright.Page,
  fn: () => Promise<void>,
) => Promise<void>;

const requireCwd = createRequire(root);
let browser: playwright.Browser;
let context: playwright.BrowserContext;

before(async () => {
  process.env.TRUST_PROXY = "1";

  browser = await playwright.chromium.launch();
  context = await browser.newContext();

  await context.addInitScript(() => {
    // needed for esbuild.
    (window as any).__name = (v: any) => v;
    __loading__ = undefined;

    const seen = new Set<string>();
    let remaining = 0;
    let resolve: undefined | (() => void);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    onMutate(document, (_, obs) => {
      if (!document.body) return;
      obs.disconnect();
      trackAssets();
      onMutate(document.body, trackAssets);
    });

    function onMutate(target: Node, fn: MutationCallback) {
      new MutationObserver(fn).observe(target, {
        childList: true,
        subtree: true,
      });
    }
    function trackAssets() {
      for (const el of document.querySelectorAll<
        HTMLScriptElement | HTMLLinkElement
      >("script[src],link[rel=stylesheet][href]")) {
        const href = "src" in el ? el.src : el.href;
        if (href && !seen.has(href)) {
          const link = document.createElement("link");
          __loading__ ||= new Promise((r) => (resolve = r));
          seen.add(href);
          remaining++;

          if ("src" in el) {
            if (el.getAttribute("type") === "module") {
              link.rel = "modulepreload";
            } else {
              link.rel = "preload";
              link.as = "script";
            }
          } else {
            link.rel = "preload";
            link.as = "style";
          }

          link.href = href;
          link.onload = link.onerror = () => {
            link.onload = link.onerror = null;
            link.remove();
            seen.delete(href);
            if (!--remaining) {
              resolve?.();
              resolve = __loading__ = undefined;
            }
          };
          document.head.append(link);
        }
      }
    }
    function onError(ev: ErrorEvent | PromiseRejectionEvent) {
      const msg =
        ev instanceof PromiseRejectionEvent
          ? `${ev.reason}\n`
          : `${ev.error || `Error loading ${(ev.target as any).outerHTML}`}\n`;
      if (!msg.includes("WebSocket closed")) {
        let errorContainer = document.getElementById("error");
        if (!errorContainer) {
          errorContainer = document.createElement("pre");
          errorContainer.id = "error";
          (document.getElementById("app") || document.body).appendChild(
            errorContainer,
          );
        }
        errorContainer.insertAdjacentText("beforeend", msg);
      }
    }
  });
});

after(async () => {
  await browser.close();
});

async function getHTML() {
  return defaultSerializer(
    defaultNormalizer(
      JSDOM.fragment(
        await page.evaluate(async () => {
          do {
            await __loading__;
            await new Promise((r) => {
              requestAnimationFrame(() => {
                const { port1, port2 } = new MessageChannel();
                port1.onmessage = r;
                port2.postMessage(0);
              });
            });
          } while (__loading__);

          return (
            (document.getElementById("app") || document.body)?.innerHTML || ""
          );
        }),
      ),
    ),
  )
    .replaceAll(process.cwd(), "")
    .replaceAll(root, "")
    .replace(/-[a-z0-9_]+(\.\w+)/gi, "-[hash]$1")
    .replace(/:(\d{4,})/g, ":9999")
    .replace(
      /\s+<script[^>]+(?:marko-vite-preload.*?<\/script>|src="\/@vite\/client".*?\/>)/gms,
      "",
    )
    .replace(/\s+<vite-error-overlay \/>/gms, "")
    .replace(/\s+<style[^>]+marko-vite-preload.*?<\/style>/gms, "")
    .replace(
      /^(\s*at)\s[^\n]+\s*\n?(?:\s*at\s[^\n]+\s*\n?)*$/gm,
      "$1 [Normalized Error Stack]",
    )
    .replace(/\\/g, "/");
}

const FIXTURES = path.join(__dirname, "fixtures");
const baseViteConfigFile = path.join(__dirname, "default.config.ts");

for (const fixture of fs.readdirSync(FIXTURES)) {
  if (fixture.startsWith(".")) {
    continue;
  }

  const dir = path.join(FIXTURES, fixture);
  const config = requireCwd(path.join(dir, "test.config.ts")) as {
    path?: string;
    entry?: string;
    steps?: Step | Step[];
    options?: Options;
    skip_dev?: boolean;
    skip_preview?: boolean;
    assert_dev?: Assert;
    assert_preview?: Assert;
    preview_args?: string[];
    timeout?: number;
    referer?: string | URL;
  };

  describe(fixture, function () {
    beforeEach(async () => {
      globalThis.page = await context.newPage();
    });

    afterEach(async () => {
      await page.close();
    });

    const pathname = config.path || "/";
    const steps = config.steps
      ? Array.isArray(config.steps)
        ? config.steps
        : [config.steps]
      : [];

    if (config.timeout != null) {
      this.timeout(config.timeout);
    }

    //suppressLogs();
    setCWD(dir);

    if (!config.skip_dev) {
      it("dev", async () => {
        environment("development");

        const configFile = await cli.getViteConfig(
          dir,
          undefined,
          undefined,
          baseViteConfigFile,
        );

        async function testBlock() {
          const server = await cli.dev(config.entry, dir, configFile);
          await testPage(page, dir, pathname, steps, server, config.referer);
        }

        if (config.assert_dev) {
          await config.assert_dev(page, testBlock);
        } else {
          await testBlock();
        }
      });
    }

    if (!config.skip_preview) {
      it("preview", async () => {
        const configFile = await cli.getViteConfig(
          dir,
          undefined,
          undefined,
          baseViteConfigFile,
        );

        async function testBlock() {
          process.env.BROWSER = "none";
          await cli.build(config.entry, dir, configFile);
          const server = await cli.preview(
            config.entry,
            undefined,
            dir,
            configFile,
            undefined,
            undefined,
            undefined,
            config.preview_args,
          );
          await testPage(page, dir, pathname, steps, server, config.referer);
        }

        if (config.assert_preview) {
          await config.assert_preview(page, testBlock);
        } else {
          await testBlock();
        }
      });
    }
  });
}

async function testPage(
  page: playwright.Page,
  dir: string,
  pathname: string,
  steps: Step[],
  server: SpawnedServer,
  referer?: string | URL,
) {
  try {
    const url = new URL(pathname, `http://localhost:${server.port}`);
    const referrerUrl = referer
      ? referer instanceof URL
        ? referer
        : new URL(referer, url)
      : undefined;

    const stepContext = { page } as StepContext;
    await waitForServer(server.port);

    stepContext.response = (await page.goto(url.href, {
      referer: referrerUrl?.href,
      waitUntil: "commit",
    }))!;

    let snapshot = "# Loading\n\n";
    let prevHtml = "";
    const contentType = await stepContext.response?.headerValue("content-type");
    if (!contentType || contentType.includes("text/html")) {
      await page.waitForSelector("body");
      const initialHtml = await getHTML();
      snapshot += htmlSnapshot(initialHtml, prevHtml);
      prevHtml = initialHtml;

      await stepContext.response.finished();
      const finalHtml = await getHTML();
      if (finalHtml !== prevHtml) {
        snapshot += htmlSnapshot(finalHtml, prevHtml);
        prevHtml = finalHtml;
      }

      for (const [i, step] of steps.entries()) {
        snapshot += `# Step ${i}\n${getStepString(step)}\n\n`;
        await step(stepContext);
        const html = await getHTML();
        if (html === prevHtml) continue;
        snapshot += htmlSnapshot(html, prevHtml);
        prevHtml = html;
      }
    } else {
      await stepContext.response.finished();
      snapshot += `\`\`\`\n${await page.content()}\n\`\`\`\n\n`;
    }

    await snap(snapshot, { ext: ".md", dir });
  } finally {
    // TODO: figure out why the dev server fails to close sometimes without this wait
    await delay(50);
    await server.close();
  }
}

function environment(nodeEnv: any) {
  const currentNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  beforeEach(() => {
    process.env.NODE_ENV = nodeEnv;
  });
  afterEach(() => {
    process.env.NODE_ENV = currentNodeEnv;
  });
}

function setCWD(dir: string) {
  const _cwd = process.cwd();
  beforeEach(() => {
    process.chdir(dir);
  });
  afterEach(() => {
    process.chdir(_cwd);
  });
}

function getStepString(step: Step) {
  return step
    .toString()
    .replace(/^.*?{\s*([\s\S]*?)\s*}.*?$/, "$1")
    .replace(/^ {4}/gm, "")
    .replace(/;$/, "");
}

function htmlSnapshot(html: string, prevHtml?: string) {
  if (prevHtml) {
    const diff = diffLines(prevHtml, html)
      .map((part) =>
        part.added ? `+${part.value}` : part.removed ? `-${part.value}` : "",
      )
      .filter(Boolean)
      .join("");
    return `\`\`\`diff\n${diff}\n\`\`\`\n\n`;
  }
  return `\`\`\`html\n${html}\n\`\`\`\n\n`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

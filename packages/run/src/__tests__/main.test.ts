import { defaultNormalizer, defaultSerializer } from "@marko/fixture-snapshots";
import { diffLines } from "diff";
import fs from "fs";
import { JSDOM } from "jsdom";
import mochaSnap from "mocha-snap";
import { createRequire } from "module";
import path from "path";
import * as playwright from "playwright";
import { fileURLToPath } from "url";

import * as cli from "../cli/commands";
import type { Options } from "../vite";
import { SpawnedServer, waitForServer } from "../vite/utils/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snap = (mochaSnap as any).default as typeof mochaSnap;
const root = process.cwd();

// https://github.com/esbuild-kit/tsx/issues/113
const { toString } = Function.prototype;
Function.prototype.toString = function () {
  return toString.call(this).replace(/\b__name\(([^,]+),[^)]+\)/g, "$1");
};

declare global {
  namespace NodeJS {
    interface Global {
      page: playwright.Page;
    }
  }
}

declare const __track__: (html: string) => void;

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
let changes: string[] = [];

before(async () => {
  process.env.TRUST_PROXY = "1";

  browser = await playwright.chromium.launch();
  context = await browser.newContext();

  /**
   * We add a mutation observer to track all mutations (batched)
   * Then we report the list of mutations in a normalized way and snapshot it.
   */
  await Promise.all([
    context.exposeFunction("__track__", (html: string) => {
      const fragment = JSDOM.fragment(html);

      // for (const pre of fragment.querySelectorAll("pre")) {
      //   if (!pre.children.length && pre.textContent) {
      //     const match = /(^\s*at (.+?:\r?\n\s+)?)/.exec(pre.textContent);
      //     if (match) {
      //       pre.textContent = match[1] + "at [Normalized Error Stack]";
      //     }
      //   }
      // }

      const formatted = defaultSerializer(defaultNormalizer(fragment));

      const normalized = formatted
        .replaceAll(process.cwd(), "")
        .replaceAll(root, "")
        .replace(/-[a-z0-9_-]+(\.\w+)/gi, "-[hash]$1")
        .replace(/:(\d{4,})/g, ":9999")
        .replace(
          /\s+<script[^>]+(?:marko-vite-preload.*?<\/script>|src="\/@vite\/client".*?\/>)/gms,
          "",
        )
        .replace(/\s+<style[^>]+marko-vite-preload.*?<\/style>/gms, "")
        .replace(
          /^(\s*at)\s[^\n]+\s*\n?(?:\s*at\s[^\n]+\s*\n?)*$/gm,
          "$1 [Normalized Error Stack]",
        )
        .replace(/\\/g, "/");

      if (changes.at(-1) !== normalized) {
        changes.push(normalized);
      }
    }),

    context.addInitScript(async function foo() {
      const getRoot = () => document.getElementById("app");

      const observer = new MutationObserver(() => {
        const html = (getRoot() || document.body).innerHTML;
        if (html) {
          __track__(html);
          observer.disconnect();
          queueMicrotask(observe);
        }
      });

      let errorContainer: HTMLElement | null = null;
      window.addEventListener("error", onError);
      document.addEventListener("error", onError, true);

      function onError(evt: ErrorEvent) {
        if (!errorContainer) {
          errorContainer = document.createElement("pre");
          (getRoot() || document.body).appendChild(errorContainer);
        }

        errorContainer.insertAdjacentText(
          "beforeend",
          `${evt.error || `Error loading ${(evt.target as any).outerHTML}`}\n`,
        );
      }

      function observe() {
        observer.observe(getRoot() || document, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
      }

      observe();
    }),
  ]);
});

after(async () => {
  await browser.close();
});

const FIXTURES = path.join(__dirname, "fixtures");

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
    let page: playwright.Page;

    beforeEach(async () => {
      changes = [];
      page = await context.newPage();
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

        const configFile = await cli.getViteConfig(dir);

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
        const configFile = await cli.getViteConfig(dir);

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
    await waitForPendingRequests(stepContext, async () => {
      stepContext.response = (await page.goto(url.href, {
        referer: referrerUrl?.href,
      }))!;
    });
    await page.waitForLoadState("domcontentloaded");
    let snapshot = `# Loading\n\n`;
    let prevHtml: string | undefined;
    const contentType = await stepContext.response?.headerValue("content-type");
    if (!contentType || contentType.includes("text/html")) {
      await forEachChange((html) => {
        snapshot += htmlSnapshot(html, prevHtml);
        prevHtml = html;
      });

      for (const [i, step] of steps.entries()) {
        await waitForPendingRequests(stepContext, step);
        snapshot += `# Step ${i}\n${getStepString(step)}\n\n`;

        let prevHtml: string | undefined;
        await forEachChange((html) => {
          snapshot += htmlSnapshot(html, prevHtml);
          prevHtml = html;
        });
      }
    } else {
      snapshot += `\`\`\`\n${await page.locator("pre").innerHTML()}\n\`\`\`\n\n`;
    }

    await snap(snapshot, { ext: ".md", dir });
  } finally {
    // TODO: figure out why the dev server fails to close sometimes without this wait
    await delay(50);
    await server.close();
  }
}

/**
 * Applies changes currently and ensures no new changes come in while processing.
 */
async function forEachChange<F extends (html: string, i: number) => unknown>(
  fn: F,
) {
  const len = changes.length;
  await Promise.all(changes.map(fn));

  if (len !== changes.length) {
    throw new Error("A mutation occurred when the page should have been idle.");
  }

  changes = [];
}

/**
 * Utility to run a function against the current page and wait until every
 * in flight network request has completed before continuing.
 */
async function waitForPendingRequests(context: StepContext, step: Step) {
  let remaining = 0;
  const { page } = context;
  let resolve!: () => void;
  const addOne = () => remaining++;
  const finishOne = async () => {
    remaining--;
    // wait a tick to see if new requests start from this one.
    await page.evaluate(() => {});
    if (!remaining) resolve();
  };
  const pending = new Promise<void>((_resolve) => (resolve = _resolve));

  page.on("request", addOne);
  page.on("requestfinished", finishOne);
  page.on("requestfailed", finishOne);

  try {
    addOne();
    await step(context);
    finishOne();
    await pending;
  } finally {
    page.off("request", addOne);
    page.off("requestfinished", finishOne);
    page.off("requestfailed", finishOne);
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

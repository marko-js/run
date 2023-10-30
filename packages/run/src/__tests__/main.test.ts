import fs from "fs";
import path from "path";
import snap from "mocha-snap";
import { JSDOM } from "jsdom";
import { createRequire } from "module";
import * as playwright from "playwright";
import { defaultNormalizer, defaultSerializer } from "@marko/fixture-snapshots";
import type { Options } from "../vite";
import { SpawnedServer, waitForServer } from "../vite/utils/server";
import * as cli from "../cli/commands";

// https://github.com/esbuild-kit/tsx/issues/113
const { toString } = Function.prototype;
Function.prototype.toString = function () {
  return toString.call(this).replace(/\b__name\(([^,]+),[^)]+\)/g, "$1");
};

declare global {
  const page: playwright.Page;
  const response: playwright.Response;
  namespace NodeJS {
    interface Global {
      page: playwright.Page;
    }
  }
}

declare namespace globalThis {
  let page: playwright.Page;
  let response: playwright.Response | null;
}

declare const __track__: (html: string) => void;

export type Step = () => Promise<unknown> | unknown;
export type Assert = (fn: () => Promise<void>) => Promise<void>;

const requireCwd = createRequire(process.cwd());
let browser: playwright.Browser;
let context: playwright.BrowserContext;
let changes: string[] = [];

before(async () => {
  browser = await playwright.chromium.launch();
  context = await browser.newContext();

  /**
   * We add a mutation observer to track all mutations (batched)
   * Then we report the list of mutations in a normalized way and snapshot it.
   */
  await Promise.all([
    context.exposeFunction("__track__", (html: string) => {
      const fragment = JSDOM.fragment(html);

      for (const pre of fragment.querySelectorAll("pre")) {
        if (!pre.children.length && pre.textContent) {
          const match = /(^\s*Error:.+(?:\r?\n\s+)?)/.exec(pre.textContent);
          if (match) {
            pre.textContent = match[1] + "at [Normalized Error Stack]";
          }
        }
      }

      const formatted = defaultSerializer(
        defaultNormalizer(fragment)
      );

      if (changes.at(-1) !== formatted) {
        changes.push(formatted);
      }
    }),
    context.addInitScript(function foo() {
      const getRoot = () => document.getElementById("app");
      const observer = new MutationObserver(() => {
        const html = (getRoot() || document.body).innerHTML;
        if (html) {
          __track__(html);
          observer.disconnect();
          queueMicrotask(observe);
        }
      });

      observe();
      function observe() {
        observer.observe(getRoot() || document, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
      }
    }),
  ]);
});

beforeEach(async () => {
  globalThis.page = await context.newPage();
});

afterEach(async () => {
  await page.close();
  globalThis.response = null;
});

after(async () => {
  await browser.close();
});

const FIXTURES = path.join(__dirname, "fixtures");

for (const fixture of fs.readdirSync(FIXTURES)) {
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
  };

  describe(fixture, () => {
    const path = config.path || "/";
    const steps = config.steps
      ? Array.isArray(config.steps)
        ? config.steps
        : [config.steps]
      : [];

    //suppressLogs();
    setCWD(dir);

    if (!config.skip_dev) {
      it("dev", async () => {
        const configFile = await cli.getViteConfig(dir);

        async function testBlock() {
          const server = await cli.dev(config.entry, dir, configFile);
          await testPage(dir, path, steps, server);
        }

        if (config.assert_dev) {
          await config.assert_dev(testBlock);
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
            configFile
          );
          await testPage(dir, path, steps, server);
        }

        if (config.assert_preview) {
          await config.assert_preview(testBlock);
        } else {
          await testBlock();
        }
      });
    }
  });
}

async function testPage(
  dir: string,
  path: string,
  steps: Step[],
  server: SpawnedServer
) {
  try {
    const url = new URL(path, `http://localhost:${server.port}`);

    await waitForServer(server.port);
    await waitForPendingRequests(page, async () => {
      globalThis.response = await page.goto(url.href);
    });

    await page.waitForSelector("body");

    await forEachChange((html, i) => {
      snap(html, `.loading.${i}.html`, dir);
    });
    for (const [i, step] of steps.entries()) {
      await waitForPendingRequests(page, step);
      await forEachChange((html, j) => {
        snap(html, `.step-${i}.${j}.html`, dir);
      });
    }
  } finally {
    await server.close();
  }
}

/**
 * Applies changes currently and ensures no new changes come in while processing.
 */
async function forEachChange<F extends (html: string, i: number) => unknown>(
  fn: F
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
async function waitForPendingRequests(page: playwright.Page, step: Step) {
  let remaining = 0;
  let resolve!: () => void;
  const addOne = () => remaining++;
  const finishOne = async () => {
    // wait a tick to see if new requests start from this one.
    await page.evaluate(() => {});
    if (!--remaining) resolve();
  };
  const pending = new Promise<void>((_resolve) => (resolve = _resolve));

  page.on("request", addOne);
  page.on("requestfinished", finishOne);
  page.on("requestfailed", finishOne);

  try {
    addOne();
    await step();
    finishOne();
    await pending;
  } finally {
    page.off("request", addOne);
    page.off("requestfinished", finishOne);
    page.off("requestfailed", finishOne);
  }
}

const noop = () => {};
const _log = console.log;
function suppressLogs() {
  beforeEach(() => {
    console.log = noop;
  });
  afterEach(() => {
    console.log = _log;
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

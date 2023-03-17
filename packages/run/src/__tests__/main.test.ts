import fs from "fs";
import path from "path";
import snap from "mocha-snap";
import { JSDOM } from "jsdom";
import { createRequire } from "module";
import * as playwright from "playwright";
import { defaultNormalizer, defaultSerializer } from "@marko/fixture-snapshots";
import type { Options } from "../vite";
import { getAvailablePort, SpawnedServer, waitForServer } from "../vite/utils/server";
import * as cli from "../cli/commands";

// https://github.com/esbuild-kit/tsx/issues/113
const { toString } = Function.prototype;
Function.prototype.toString = function () {
  return toString.call(this).replace(/\b__name\(([^,]+),[^)]+\)/g, "$1");
}

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

declare const __track__: (html: string) => void;
type Step = () => Promise<unknown> | unknown;

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
      const formatted = defaultSerializer(
        defaultNormalizer(JSDOM.fragment(html))
      );

      if (changes.at(-1) !== formatted) {
        changes.push(formatted);
      }
    }),
    context.addInitScript(function foo() {
      debugger;
      const getRoot = () => document.getElementById("app");
      const observer = new MutationObserver(() => {
        const html = getRoot()?.innerHTML;
        if (html) {
          __track__(html);
          observer.disconnect();
          queueMicrotask(observe);
        }
      });

      observe();
      function observe() {
        debugger;
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
})

afterEach(async () => {
  await page.close();
})

after(async () => {
  await browser.close()
});

const FIXTURES = path.join(__dirname, "fixtures");

for (const fixture of fs.readdirSync(FIXTURES)) {
  const dir = path.join(FIXTURES, fixture);
  const config = requireCwd(path.join(dir, "test.config.ts")) as {
    path?: string;
    entry?: string;
    dev_cmd?: string;
    steps?: Step | Step[];
    options?: Options;
    skip_dev?: boolean;
    skip_preview?: boolean;
  };

  describe(fixture, () => {
    const path = config.path || '/';
    const steps = config.steps
      ? Array.isArray(config.steps)
        ? config.steps
        : [config.steps]
      : [];

    suppressLogs();

    if (!config.skip_dev) {
      it("dev", async () => {
        const configFile = await cli.getViteConfig(dir);
        const port = await getAvailablePort();
        const server = await cli.dev(config.dev_cmd, dir, configFile, port);
        await testPage(dir, path, steps, server);
      });
    }

    if (!config.skip_preview) {
      it("preview", async () => {
        process.env.BROWSER = "none";

        const configFile = await cli.getViteConfig(dir);
        const port = await getAvailablePort();
        await cli.build(config.entry, dir, configFile);
        const server = await cli.preview(undefined, dir, configFile, port);
        await testPage(dir, path, steps, server);
      });
    }
  });
}

async function testPage(dir: string, path: string, steps: Step[], server: SpawnedServer) {
  try {
    const url = new URL(`http://localhost:${server.port}`);
    url.pathname = path;

    await waitForServer(server.port);
    await waitForPendingRequests(page, () => page.goto(url.href));
    await page.waitForSelector("#app");
    await forEachChange((html, i) => snap(html, `.loading.${i}.html`, dir));
    for (const [i, step] of steps.entries()) {
      await waitForPendingRequests(page, step);
      await forEachChange((html, j) => {
        snap(html, `.step-${i}.${j}.html`, dir)
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
  })
  afterEach(() => {
    console.log = _log;
  })
}
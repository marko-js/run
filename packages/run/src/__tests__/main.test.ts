import { defaultNormalizer, defaultSerializer } from "@marko/fixture-snapshots";
import { diffLines } from "diff";
import fs from "fs";
import { JSDOM } from "jsdom";
import snap from "mocha-snap";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

import * as cli from "../cli/commands";
import type { Options } from "../vite";
import { SpawnedServer, waitForServer } from "../vite/utils/server";
import { BrowserPage } from "./utils/browser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();

// https://github.com/esbuild-kit/tsx/issues/113
const { toString } = Function.prototype;
Function.prototype.toString = function () {
  return toString.call(this).replace(/\b__name\(([^,]+),[^)]+\)/g, "$1");
};

export type StepContext = {
  page: BrowserPage;
  response: Response;
};
export type Step = (context: StepContext) => Promise<unknown> | unknown;
export type Assert = (
  page: BrowserPage,
  fn: () => Promise<void>,
) => Promise<void>;

const requireCwd = createRequire(root);
let page: BrowserPage;

before(() => {
  process.env.TRUST_PROXY = "1";
});

async function getHTML(settle = true) {
  if (settle) await page.settle();
  const { document } = page;
  return defaultSerializer(
    defaultNormalizer(
      JSDOM.fragment(
        (document.getElementById("app") || document.body)?.innerHTML || "",
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
    beforeEach(() => {
      page = new BrowserPage();
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
      it("dev", () =>
        withEnvironment("development", async () => {
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
        }));
    }

    if (!config.skip_preview) {
      it("preview", () =>
        withEnvironment("production", async () => {
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
        }));
    }
  });
}

async function testPage(
  page: BrowserPage,
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

    let snapshot = "# Loading\n\n";
    let prevHtml = "";
    await page.goto(url.href, {
      referer: referrerUrl?.href,
      async onBodyReady() {
        if (!prevHtml) {
          prevHtml = await getHTML(false);
          snapshot += htmlSnapshot(prevHtml);
        }
      },
    });
    stepContext.response = page.response;

    if (page.window) {
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
      snapshot += `\`\`\`\n${await page.response.text()}\n\`\`\`\n\n`;
    }

    await snap(snapshot, { ext: ".md", dir });
  } finally {
    await server.close();
  }
}

async function withEnvironment(nodeEnv: any, fn: () => Promise<void>) {
  const currentNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    await fn();
  } finally {
    process.env.NODE_ENV = currentNodeEnv;
  }
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

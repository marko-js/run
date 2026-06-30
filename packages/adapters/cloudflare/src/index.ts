import baseAdapter, { type Adapter } from "@marko/run/adapter";
import { execSync, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export type { CloudflareEnv, CloudflarePlatformInfo } from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "default-entry");

/** Generated when no Wrangler config is found at the project root. */
const COMPATIBILITY_DATE = "2024-11-01";

export interface Options {
  /**
   * The Cloudflare product to target.
   *
   * - `"workers"` (default) builds a Worker with a static assets binding,
   *   deployed with `wrangler deploy`.
   * - `"pages"` builds a Cloudflare Pages "advanced mode" `_worker.js`
   *   alongside the static assets, deployed with `wrangler pages deploy`.
   */
  mode?: "workers" | "pages";
}

export default function cloudflareAdapter(options: Options = {}): Adapter {
  const { mode = "workers" } = options;
  const { startDev } = baseAdapter();

  return {
    name: "cloudflare-adapter",

    viteConfig(config) {
      if (config.build?.ssr) {
        return {
          ssr: {
            target: "webworker",
            resolve: {
              dedupe: ["marko"],
              conditions: [
                "workerd",
                "worker",
                "browser",
                "import",
                "require",
                "production",
                "default",
              ],
            },
            noExternal: true,
          },
        };
      }
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

    async startPreview({ options: previewOptions }) {
      assertWranglerCLI();

      const { port = 3000, cwd, dir } = previewOptions;
      const publicDir = path.join(dir, "public");

      const args =
        mode === "pages"
          ? ["pages", "dev", publicDir, "--port", port.toString()]
          : [
              "dev",
              "--config",
              path.join(dir, "wrangler.json"),
              "--port",
              port.toString(),
            ];

      args.push(...parseWranglerArgs(previewOptions.args));

      const proc = spawn("wrangler", args, {
        cwd,
        env: process.env,
        shell: true,
      });

      if (process.env.NODE_ENV !== "test") {
        proc.stdout.pipe(process.stdout);
      }
      proc.stderr.pipe(process.stderr);

      return {
        port,
        close() {
          proc.unref();
          proc.kill();
        },
      };
    },

    async buildEnd({ config, builtEntries }) {
      const serverEntry = builtEntries[0];
      if (!serverEntry) {
        return;
      }

      // During the client build `outDir` points at the static assets dir
      // (`<outDir>/public`); its parent is the SSR build dir that holds the
      // built worker entry.
      const publicDir = path.resolve(config.root, config.build.outDir);
      const distDir = path.dirname(publicDir);

      if (mode === "pages") {
        // Advanced mode: a single `_worker.js` sits next to the static assets
        // and a `_routes.json` keeps static files from invoking the worker.
        const exclude = await collectStaticRoutes(publicDir);
        await fs.rename(serverEntry, path.join(publicDir, "_worker.js"));
        await fs.writeFile(
          path.join(publicDir, "_routes.json"),
          JSON.stringify({ version: 1, include: ["/*"], exclude }, null, 2),
        );
      } else {
        // Workers: keep the worker bundle in the dist root and point a
        // generated Wrangler config at it and the static assets. An existing
        // project-level Wrangler config is left untouched.
        const workerEntry = path.join(distDir, "_worker.js");
        if (path.resolve(serverEntry) !== workerEntry) {
          await fs.rename(serverEntry, workerEntry);
        }

        if (!(await hasRootWranglerConfig(config.root))) {
          await fs.writeFile(
            path.join(distDir, "wrangler.json"),
            JSON.stringify(
              {
                name: "marko-run-app",
                main: "_worker.js",
                compatibility_date: COMPATIBILITY_DATE,
                compatibility_flags: ["nodejs_compat"],
                assets: {
                  directory: "./public",
                  binding: "ASSETS",
                },
              },
              null,
              2,
            ),
          );
        }
      }
    },

    typeInfo(writer) {
      writer(
        `import type { CloudflarePlatformInfo } from '@marko/run-adapter-cloudflare';`,
      );
      return "CloudflarePlatformInfo";
    },
  };
}

/**
 * Build a `_routes.json` exclude list from the top-level entries of the static
 * assets directory so Cloudflare Pages serves them directly instead of
 * invoking the worker. Cloudflare allows at most 100 exclude rules.
 */
async function collectStaticRoutes(publicDir: string): Promise<string[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(publicDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const exclude: string[] = [];
  for (const entry of entries) {
    if (entry.name === "_worker.js" || entry.name === "_routes.json") {
      continue;
    }
    exclude.push(entry.isDirectory() ? `/${entry.name}/*` : `/${entry.name}`);
    if (exclude.length >= 100) {
      break;
    }
  }
  return exclude;
}

async function hasRootWranglerConfig(root: string): Promise<boolean> {
  for (const name of ["wrangler.toml", "wrangler.json", "wrangler.jsonc"]) {
    try {
      await fs.access(path.join(root, name));
      return true;
    } catch {
      // not found, keep looking
    }
  }
  return false;
}

const devFlags = new RegExp(
  [
    "compatibility-date=.+",
    "compatibility-flags=.+",
    "env=.+",
    "ip=.+",
    "local-protocol=.+",
    "https-key-path=.+",
    "https-cert-path=.+",
    "inspector-port=.+",
    "live-reload",
    "remote",
    "local",
    "show-interactive-dev-session",
  ]
    .map((flag) => `--${flag}`)
    .join("|"),
);

function parseWranglerArgs(args: string[]) {
  return args.filter((arg) => devFlags.test(arg));
}

function assertWranglerCLI() {
  try {
    execSync("wrangler --version");
  } catch (error) {
    console.warn(
      `Wrangler CLI not found. Please install it with \`npm install -D wrangler\``,
    );
    process.exit(1);
  }
}

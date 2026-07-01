import baseAdapter, { type Adapter } from "@marko/run/adapter";
import { execSync, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export type { VercelEdgePlatformInfo, VercelNodePlatformInfo } from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEdgeEntry = path.join(__dirname, "default-edge-entry");
const defaultNodeEntry = path.join(__dirname, "default-node-entry");

/** Used for the generated Node Serverless Function. */
const NODE_RUNTIME = "nodejs20.x";

export interface Options {
  /**
   * Build for Vercel's Edge runtime instead of the Node.js Serverless
   * runtime. Edge Functions run on a web-standard runtime at the edge.
   */
  edge?: boolean;
}

export default function vercelAdapter(options: Options = {}): Adapter {
  const { edge = false } = options;
  const { startDev } = baseAdapter();
  const defaultEntry = edge ? defaultEdgeEntry : defaultNodeEntry;

  return {
    name: "vercel-adapter",

    viteConfig(config) {
      if (config.build?.ssr) {
        return edge
          ? {
              ssr: {
                target: "webworker",
                resolve: {
                  dedupe: ["marko"],
                  conditions: [
                    "edge-light",
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
            }
          : {
              ssr: {
                target: "node",
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
      assertVercelCLI();

      const { port = 3000, cwd } = previewOptions;

      const args = ["dev", "--listen", port.toString()];
      args.push(...parseVercelArgs(previewOptions.args));

      // Spawn through a shell only on Windows, where `vercel` is a `.cmd` shim
      // that can't be spawned directly. On POSIX, spawning directly means
      // `close()` terminates the CLI itself (not a shell wrapper) and avoids
      // the shell re-parsing the argument values.
      const proc = spawn("vercel", args, {
        cwd,
        env: process.env,
        shell: process.platform === "win32",
      });

      proc.on("error", (err) => {
        console.error("Failed to start vercel preview server:", err);
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
      // built server entry.
      const publicDir = path.resolve(config.root, config.build.outDir);

      // Assemble a Vercel Build Output API (v3) directory. Vercel uses this
      // directly when it exists after the build.
      // https://vercel.com/docs/build-output-api/v3
      const outputDir = path.join(config.root, ".vercel", "output");
      const staticDir = path.join(outputDir, "static");
      const funcDir = path.join(outputDir, "functions", "index.func");

      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.mkdir(funcDir, { recursive: true });
      await copyDir(publicDir, staticDir);

      await fs.rename(serverEntry, path.join(funcDir, "index.js"));
      await fs.writeFile(
        path.join(funcDir, "package.json"),
        JSON.stringify({ type: "module" }, null, 2),
      );
      await fs.writeFile(
        path.join(funcDir, ".vc-config.json"),
        JSON.stringify(
          edge
            ? { runtime: "edge", entrypoint: "index.js" }
            : {
                runtime: NODE_RUNTIME,
                handler: "index.js",
                launcherType: "Nodejs",
                shouldAddHelpers: false,
              },
          null,
          2,
        ),
      );

      await fs.writeFile(
        path.join(outputDir, "config.json"),
        JSON.stringify(
          {
            version: 3,
            routes: [
              { handle: "filesystem" },
              { src: "/(.*)", dest: "/index" },
            ],
          },
          null,
          2,
        ),
      );
    },

    typeInfo(writer) {
      if (edge) {
        writer(
          `import type { VercelEdgePlatformInfo } from '@marko/run-adapter-vercel';`,
        );
        return "VercelEdgePlatformInfo";
      }
      writer(
        `import type { VercelNodePlatformInfo } from '@marko/run-adapter-vercel';`,
      );
      return "VercelNodePlatformInfo";
    },
  };
}

const devFlags = new RegExp(
  ["debug", "env=.+", "build-env=.+", "yes", "token=.+", "scope=.+"]
    .map((flag) => `--${flag}`)
    .join("|"),
);

function parseVercelArgs(args: string[]) {
  return args.filter((arg) => devFlags.test(arg));
}

function assertVercelCLI() {
  try {
    execSync("vercel --version");
  } catch {
    throw new Error(
      "Vercel CLI not found. Please install it with `npm install -g vercel`.",
    );
  }
}

/** Recursively copy a directory (kept `fs.cp`-free for older Node support). */
async function copyDir(from: string, to: string) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dest);
    } else {
      await fs.copyFile(src, dest);
    }
  }
}

import type { Adapter } from "@marko/run/adapter";
import { loadEnv } from "@marko/run/vite";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type { CloudflareEnv, CloudflarePlatformInfo } from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "default-entry");

/** Used when the Wrangler config doesn't provide one. */
const COMPATIBILITY_DATE = "2024-11-01";

/**
 * The @marko/run adapter for Cloudflare Workers, wrapping
 * @cloudflare/vite-plugin. The plugin is pinned to Vite's `ssr` environment —
 * the one @marko/run builds its server into — so it makes that environment
 * workerd-shaped (resolve conditions, dev module runner, deploy output) while
 * marko-run keeps owning routing and the linked client/server build.
 */
export default function cloudflareAdapter(): Adapter {
  let devEntry: string | undefined;

  return {
    name: "cloudflare-adapter",

    async plugins() {
      const { cloudflare } = await import("@cloudflare/vite-plugin");

      const plugins = cloudflare({
        // Run the Worker in Vite's `ssr` environment — @marko/vite compiles
        // templates for the server based on the environment name, so a
        // worker-named environment would get browser output.
        viteEnvironment: { name: "ssr" },
        // Fill in what a project-level Wrangler config would otherwise need
        // to say about this adapter: `main` is the Worker entry marko-run
        // runs/builds (the user's custom dev entry when one was passed), and
        // the compatibility/assets defaults make config-less projects work.
        // Everything else (bindings, vars, name, routes...) comes from the
        // project's Wrangler config when present.
        config(workerConfig) {
          const overrides: Record<string, unknown> = {
            main: resolveEntryFile(devEntry ?? defaultEntry),
          };
          if (!workerConfig.compatibility_date) {
            overrides.compatibility_date = COMPATIBILITY_DATE;
          }
          if (!workerConfig.compatibility_flags?.length) {
            overrides.compatibility_flags = ["nodejs_compat"];
          }
          if (!workerConfig.assets?.binding) {
            overrides.assets = { binding: "ASSETS" };
          }
          return overrides;
        },
      });

      return [
        ...plugins,
        {
          name: "marko-run-adapter-cloudflare:post",
          // The Cloudflare plugin enables `build.manifest` for the Worker
          // environment but doesn't rely on it for the emitted wrangler.json,
          // and Vite's native manifest plugin can crash when other plugins
          // also emit assets during `generateBundle`. marko-run doesn't need
          // an SSR manifest either, so turn it back off.
          config() {
            return {
              environments: { ssr: { build: { manifest: false } } },
            };
          },
        },
      ];
    },

    getEntryFile() {
      return defaultEntry;
    },

    async startDev({ entry, config, options }) {
      const { createServer } = await import("vite");
      const { port = 3000, envFile } = options;

      if (envFile) {
        await loadEnv(envFile);
      }

      // Record the entry for the plugin's Worker config, resolved when the
      // dev server initializes below — every entry (default or custom) runs
      // as the Worker `main` inside workerd.
      devEntry = entry === defaultEntry ? undefined : entry;

      const server = await createServer({
        ...config,
        server: { ...config.server, port },
      });
      await server.listen();
      server.printUrls();

      return {
        port: server.config.server.port ?? port,
        close: () => server.close(),
      };
    },

    buildEnd({ config }) {
      // marko-run's client pass writes under `<out>/public`, but the plugin's
      // emitted wrangler.json expects assets at `<out>/client` — hoist them so
      // the emitted config works untouched for `wrangler dev` and `deploy`.
      // (This hook runs on the client pass, whose outDir the plugin rewrote to
      // `<out>/public/client`; walk back up to the build root.)
      const out = path.resolve(config.root, config.build.outDir);
      const root = out.endsWith(path.join("public", "client"))
        ? path.dirname(path.dirname(out))
        : out;
      const nested = path.join(root, "public", "client");
      if (fs.existsSync(nested)) {
        fs.renameSync(nested, path.join(root, "client"));
        fs.rmdirSync(path.join(root, "public"));
      }
    },

    async startPreview({ options }) {
      assertWranglerCLI();

      const { port = 3000, cwd, dir, envFile } = options;
      if (envFile) {
        await loadEnv(envFile);
      }

      // Emitted by @cloudflare/vite-plugin during the build alongside the
      // bundled Worker.
      const wranglerConfig = path.join(dir, "ssr", "wrangler.json");
      if (!fs.existsSync(wranglerConfig)) {
        throw new Error(
          `No Wrangler config found at '${wranglerConfig}' — run the build first.`,
        );
      }

      const args = [
        "dev",
        "--config",
        wranglerConfig,
        "--port",
        port.toString(),
        ...parseWranglerArgs(options.args),
      ];

      // Spawn through a shell only on Windows, where `wrangler` is a `.cmd`
      // shim that can't be spawned directly. On POSIX, spawning directly means
      // `close()` terminates Wrangler itself (not a shell wrapper) and avoids
      // the shell re-parsing the argument values.
      const proc = spawn("wrangler", args, {
        cwd,
        env: process.env,
        shell: process.platform === "win32",
      });

      proc.on("error", (err) => {
        console.error("Failed to start wrangler preview server:", err);
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

    typeInfo(writer) {
      writer(
        `import type { CloudflarePlatformInfo } from '@marko/run-adapter-cloudflare';`,
      );
      return "CloudflarePlatformInfo";
    },
  };
}

/**
 * Resolve the extension the CLI leaves off the adapter's default entry, since
 * Wrangler requires `main` to be an existing file.
 */
function resolveEntryFile(entry: string): string {
  if (!path.extname(entry)) {
    for (const ext of [".ts", ".mjs", ".js"]) {
      if (fs.existsSync(entry + ext)) {
        return entry + ext;
      }
    }
  }
  return entry;
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
  } catch {
    throw new Error(
      "Wrangler CLI not found. Please install it with `npm install -D wrangler`.",
    );
  }
}

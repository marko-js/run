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
  return {
    name: "cloudflare-adapter",

    async plugins({ root, entry }) {
      const { cloudflare } = await import("@cloudflare/vite-plugin");

      const plugins = cloudflare({
        // Run the Worker in Vite's `ssr` environment — @marko/vite compiles
        // templates for the server based on the environment name, so a
        // worker-named environment would get browser output.
        viteEnvironment: { name: "ssr" },
        // Fill in what a project-level Wrangler config would otherwise need
        // to say about this adapter: `main` is the Worker entry and the
        // compatibility/assets defaults make config-less projects work. The
        // plugin wraps `main` as the Worker and drives both the dev module
        // runner and the SSR build from it, so it must match the entry
        // marko-run builds: the one it was given (`marko-run build
        // src/index.ts`), which can export Durable Objects and the like, or
        // this adapter's default, which delegates to marko-run's router.
        // Everything else (bindings, vars, name, routes...) comes from the
        // project's Wrangler config when present.
        config(workerConfig) {
          const overrides: Record<string, unknown> = {
            main: resolveEntryFile(
              entry ? path.resolve(root, entry) : defaultEntry,
            ),
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

    async startDev({ config, options }) {
      const { createServer } = await import("vite");
      const { port = 3000, envFile } = options;

      if (envFile) {
        await loadEnv(envFile);
      }

      // The Cloudflare plugin (from `plugins()`) takes over the `ssr`
      // environment's dev module runner, so this plain Vite dev server runs
      // the Worker — and marko-run's routes — inside workerd.
      // marko-run already picked a free port, so taking another would leave
      // it reporting the wrong one.
      const server = await createServer({
        ...config,
        server: { ...config.server, port, strictPort: true },
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

      const wranglerArgs = parseWranglerArgs(options.args);
      const args = [
        "dev",
        "--config",
        wranglerConfig,
        "--port",
        port.toString(),
        ...wranglerArgs,
        ...(await viteServerArgs(cwd, wranglerArgs)),
      ];
      // Share dev's local bindings rather than keep them beside the build.
      if (!hasFlag(wranglerArgs, "persist-to")) {
        args.push("--persist-to", path.join(cwd, ".wrangler", "state"));
      }

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

/**
 * Wrangler flags for the `host` and `https` of the project's Vite config
 * (`preview`, falling back to `server`), so one config covers dev and
 * preview: a host means listening there (`true`, every interface), and a
 * key and cert pair means serving over TLS. Flags passed to preview win.
 */
async function viteServerArgs(cwd: string, given: string[]) {
  const { resolveConfig } = await import("vite");
  const config = await resolveConfig(
    { root: cwd, logLevel: "silent" },
    "serve",
  );
  const args: string[] = [];
  const host = config.preview.host ?? config.server.host;
  if (host && !hasFlag(given, "ip")) {
    args.push("--ip", host === true ? "0.0.0.0" : host);
  }
  const https = config.preview.https ?? config.server.https;
  if (https?.key && https?.cert && !hasFlag(given, "local-protocol")) {
    // Wrangler takes the key and cert as files, so they go in Vite's cache,
    // out of the build output.
    const dir = path.join(config.cacheDir, "cloudflare-preview");
    fs.mkdirSync(dir, { recursive: true });
    const write = (name: string, value: unknown) => {
      const file = path.join(dir, name);
      fs.writeFileSync(
        file,
        Array.isArray(value) ? value.join("\n") : (value as string | Buffer),
      );
      return file;
    };
    args.push(
      "--local-protocol",
      "https",
      "--https-key-path",
      write("key.pem", https.key),
      "--https-cert-path",
      write("cert.pem", https.cert),
    );
  }
  return args;
}

/** The `wrangler dev` flags preview passes on that take a value. */
const valueFlags = new Set([
  "compatibility-date",
  "compatibility-flags",
  "env",
  "ip",
  "local-protocol",
  "https-key-path",
  "https-cert-path",
  "inspector-port",
  "persist-to",
]);

/** The `wrangler dev` flags preview passes on that take none. */
const switchFlags = new Set([
  "live-reload",
  "remote",
  "local",
  "show-interactive-dev-session",
]);

/**
 * The flags preview was given that `wrangler dev` takes, a value flag with
 * its value whether written `--flag=value` or `--flag value`. As in wrangler,
 * a flag after a value flag is the next flag, not its value.
 */
function parseWranglerArgs(args: string[]) {
  const kept: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const name = flagName(arg);
    if (switchFlags.has(name)) {
      kept.push(arg);
    } else if (valueFlags.has(name)) {
      if (arg.includes("=")) {
        kept.push(arg);
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        kept.push(arg, args[++i]);
      }
    }
  }
  return kept;
}

function hasFlag(args: string[], name: string) {
  return args.some((arg) => flagName(arg) === name);
}

function flagName(arg: string) {
  return arg.startsWith("--") ? arg.slice(2).split("=", 1)[0] : "";
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

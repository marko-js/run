import baseAdapter, { type Adapter } from "@marko/run/adapter";
import { execSync, spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

export type { BunPlatformInfo } from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "default-entry");

export default function bunAdapter(): Adapter {
  const { startDev } = baseAdapter();

  return {
    name: "bun-adapter",

    viteConfig(config) {
      if (config.build?.ssr) {
        return {
          ssr: {
            // Bun is Node-compatible; bundle everything so the built server is
            // self-contained.
            target: "node",
            resolve: {
              dedupe: ["marko"],
              conditions: [
                "bun",
                "worker",
                "node",
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

    async startPreview({ entry, options: previewOptions }) {
      assertBunCLI();

      const { port = 3000, cwd, dir } = previewOptions;
      const entryFile = entry || path.join(dir, "index.mjs");

      // Spawn through a shell only on Windows (needed when `bun` is a `.cmd`
      // shim). On POSIX, spawning directly means `close()` terminates Bun
      // itself (not a shell wrapper) and avoids the shell re-parsing the
      // argument values.
      const proc = spawn("bun", ["run", entryFile], {
        cwd,
        env: { ...process.env, PORT: port.toString() },
        shell: process.platform === "win32",
      });

      proc.on("error", (err) => {
        console.error("Failed to start bun preview server:", err);
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
      writer(`import type { BunPlatformInfo } from '@marko/run-adapter-bun';`);
      return "BunPlatformInfo";
    },
  };
}

function assertBunCLI() {
  try {
    execSync("bun --version");
  } catch {
    throw new Error(
      "Bun not found. Please install it from https://bun.sh (`curl -fsSL https://bun.sh/install | bash`).",
    );
  }
}

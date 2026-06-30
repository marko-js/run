import baseAdapter, { type Adapter } from "@marko/run/adapter";
import { execSync, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export type { DenoPlatformInfo } from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "default-entry");

export default function denoAdapter(): Adapter {
  const { startDev } = baseAdapter();

  return {
    name: "deno-adapter",

    viteConfig(config) {
      if (config.build?.ssr) {
        return {
          ssr: {
            target: "webworker",
            resolve: {
              dedupe: ["marko"],
              conditions: [
                "deno",
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
      assertDenoCLI();

      const { port = 3000, cwd, dir } = previewOptions;
      const entry = path.join(dir, "index.js");

      const args = ["run", "--allow-net", "--allow-read", "--allow-env", entry];

      const proc = spawn("deno", args, {
        cwd,
        env: { ...process.env, PORT: port.toString() },
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
      // (`<outDir>/public`); its parent is the build dir that holds the built
      // server entry. Give the entry a stable name so it can be run/deployed
      // as `<outDir>/index.js` (it resolves `./public` relative to itself).
      const publicDir = path.resolve(config.root, config.build.outDir);
      const distDir = path.dirname(publicDir);
      const entry = path.join(distDir, "index.js");

      if (path.resolve(serverEntry) !== entry) {
        await fs.rename(serverEntry, entry);
      }
    },

    typeInfo(writer) {
      writer(
        `import type { DenoPlatformInfo } from '@marko/run-adapter-deno';`,
      );
      return "DenoPlatformInfo";
    },
  };
}

function assertDenoCLI() {
  try {
    execSync("deno --version");
  } catch (error) {
    console.warn(
      `Deno not found. Please install it from https://deno.com (\`curl -fsSL https://deno.land/install.sh | sh\`)`,
    );
    process.exit(1);
  }
}

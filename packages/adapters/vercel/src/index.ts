import baseAdapter, { type Adapter } from "@marko/run/adapter";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { startPreviewServer } from "./preview";

export type { VercelNodePlatformInfo } from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "default-node-entry");

/** Used for the generated Node Serverless Function. */
const NODE_RUNTIME = "nodejs20.x";

export default function vercelAdapter(): Adapter {
  const { startDev } = baseAdapter();

  return {
    name: "vercel-adapter",

    viteConfig(config) {
      if (config.build?.ssr) {
        return {
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
      const { port = 3000, cwd } = previewOptions;

      // The build writes a Vercel Build Output API directory here; serve it
      // directly (see `startPreviewServer` for why the Vercel CLI can't).
      const outputDir = path.join(cwd, ".vercel", "output");
      return startPreviewServer({ outputDir, port });
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
          {
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
      writer(
        `import type { VercelNodePlatformInfo } from '@marko/run-adapter-vercel';`,
      );
      return "VercelNodePlatformInfo";
    },
  };
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

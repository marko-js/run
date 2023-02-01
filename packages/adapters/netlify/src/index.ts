import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import type { Adapter } from "@marko/run/vite";

import { bundle } from "@hattip/bundler-netlify";
import baseAdapter from "@marko/run/adapter";
import { existsSync } from "fs";
import { spawn } from "child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export interface Options {
  edge?: boolean;
}

export default function staticAdapter(options: Options = {}): Adapter {
  const { startDev } = baseAdapter();
  return {
    name: "netlify-adapter",

    viteConfig(config) {
      if (config.build?.ssr) {
        return {
          resolve: {
            dedupe: ["marko"],
            conditions: options.edge ? ["worker"] : undefined,
          },
          ssr: {
            target: options.edge ? "webworker" : "node",
            noExternal: true,
          },
        };
      }
    },

    getEntryFile() {
      return path.join(
        __dirname,
        options.edge ? "default-edge-entry" : "default-functions-entry"
      );
    },

    startDev,

    async startPreview(_dir, _entry, port) {
      const args = ["--framework", "#static", "--dir", "netlify"];
      if (port !== undefined) {
        args.push("--port", "" + port);
      }
      const proc = spawn("netlify", ["dev", ...args]);
      proc.stdout.pipe(process.stdout);
      proc.stderr.pipe(process.stderr);
    },

    async buildEnd(config, _routes, builtEntries, _sourceEntries) {
      const distDir = config.build.outDir;
      const entry = builtEntries[0];
      await bundle({
        edgeEntry: options.edge ? entry : undefined,
        functionEntry: options.edge ? undefined : entry,

        manipulateEsbuildOptions(options) {
          options.minify = false;
          options.minifyIdentifiers = false;
          options.minifySyntax = false;
          options.minifyWhitespace = false;
        },
      });

      for (const dir of ["assets"]) {
        await fs.cp(
          path.join(distDir, dir),
          path.join(config.root, "netlify", dir),
          { recursive: true, force: true }
        );
      }

      if (options.edge) {
        const functionsDir = path.join(
          config.root,
          "netlify",
          "edge-functions"
        );
        const functionsDir2 = path.join(functionsDir, "edge");
        if (existsSync(functionsDir2)) {
          await fs.cp(functionsDir2, functionsDir, { recursive: true, force: true });
          await fs.rm(functionsDir2, { recursive: true });
        }

        const metaDir = path.join(config.root, ".netlify", "edge-functions");
        if (!existsSync(metaDir)) {
          await fs.mkdir(metaDir, { recursive: true });
        }
        await fs.writeFile(
          path.join(metaDir, "manifest.json"),
          `{
  "functions": [
    {
      "function": "index",
      "pattern": "^[^.]*$"
    }
  ],
  "version": 1
}`,
          "utf-8"
        );
      } else {
      }

      //await fs.rm(distDir, { recursive: true, maxRetries: 5 });
    },
  };
}

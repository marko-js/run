import baseAdapter, { type Adapter } from "@marko/run/adapter";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type { VercelPlatformInfo } from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "default-entry");
const previewEntry = path.join(__dirname, "preview-entry.mjs");

/**
 * Settings for the generated Vercel Function.
 * https://vercel.com/docs/build-output-api/primitives#serverless-function-configuration
 */
export interface Options {
  /** Node.js runtime, eg. `nodejs24.x`. Defaults to the build's Node.js major, rounded down to an LTS. */
  runtime?: string;
  /** Regions the function is deployed to, eg. `["iad1"]`. Defaults to the project's setting. */
  regions?: string[];
  /** Memory in MB allocated to the function. */
  memory?: number;
  /** Maximum duration in seconds, or `"max"` for the plan's limit. */
  maxDuration?: number | "max";
}

export default function vercelAdapter(options: Options = {}): Adapter {
  const { startDev, startPreview } = baseAdapter({ getEntryHandler });

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

    startDev,

    startPreview(event) {
      // `preview-entry.mjs` serves `.vercel/output`, not the CLI's build-dir entry.
      return startPreview!({ ...event, entry: previewEntry });
    },

    buildEnd({ config, builtEntries }) {
      if (!builtEntries.length) {
        return;
      }

      // During the client build `outDir` is the static assets dir inside the
      // SSR build dir, which holds the server entry and its chunks.
      const publicDir = path.resolve(config.root, config.build.outDir);
      const serverDir = path.dirname(publicDir);

      // https://vercel.com/docs/build-output-api/v3
      const outputDir = path.join(config.root, ".vercel", "output");
      const staticDir = path.join(outputDir, "static");
      const funcDir = path.join(outputDir, "functions", "index.func");
      const handler = path.relative(serverDir, builtEntries[0]);

      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.cpSync(publicDir, staticDir, { recursive: true });
      fs.cpSync(serverDir, funcDir, {
        recursive: true,
        filter: (src) => src !== publicDir,
      });

      writeJSON(path.join(funcDir, "package.json"), { type: "module" });
      writeJSON(path.join(funcDir, ".vc-config.json"), {
        runtime: options.runtime || getDefaultRuntime(),
        handler,
        launcherType: "Nodejs",
        shouldAddHelpers: false,
        supportsResponseStreaming: true,
        regions: options.regions,
        memory: options.memory,
        maxDuration: options.maxDuration,
      });
      writeJSON(path.join(outputDir, "config.json"), {
        version: 3,
        routes: [
          {
            src: `^/${escapeRegExp(config.build.assetsDir)}/(.*)$`,
            headers: { "cache-control": "public, max-age=31536000, immutable" },
            continue: true,
          },
          { handle: "filesystem" },
          { src: "/(.*)", dest: "/index" },
        ],
      });
    },

    typeInfo(writer) {
      writer(
        `import type { VercelPlatformInfo } from '@marko/run-adapter-vercel';`,
      );
      return "VercelPlatformInfo";
    },
  };
}

/** The build's Node.js major, rounded down to an LTS since Vercel runs only even majors. */
function getDefaultRuntime() {
  const major = parseInt(process.versions.node, 10);
  return `nodejs${major - (major % 2)}.x`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function writeJSON(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/** Serves dev requests through a function entry the way Vercel calls it: `fetch` with the request alone. */
function getEntryHandler({ default: entry }: Record<string, any>) {
  if (typeof entry?.fetch !== "function") {
    throw new Error(
      "A Vercel function entry's default export must be an object with a `fetch(request)` method.",
    );
  }
  // Called as a method with no `platform`, as Vercel calls it.
  return (request: Request) => entry.fetch(request);
}

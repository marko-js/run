import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import baseAdapter, { type Adapter } from "@marko/run/adapter";
import {
  bundleEdgeFunction,
  bundleRegularFunction,
  type NetlifyBundlerOptions,
} from "@hattip/bundler-netlify";
import { existsSync } from "fs";
import { spawn } from "child_process";

export type {
  NetlifyFunctionsPlatformInfo,
  NetlifyEdgePlatformInfo,
} from "./types";

const __dirname = fileURLToPath(path.dirname(import.meta.url));

export interface Options {
  edge?: boolean;
}

export default function netlifyAdapter(options: Options = {}): Adapter {
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

    async startPreview(_entry, options) {
      const { port = 8888, cwd } = options;

      const args = [
        "dev",
        "--framework",
        "#static",
        "--dir",
        "netlify",
        "--port",
        port.toString(),
        ...parseNetlifyArgs(options.args),
      ];

      const proc = spawn("netlify", args, {
        cwd,
        env: { ...process.env, DENO_TLS_CA_STORE: "mozilla,system" },
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

    async buildEnd(config, _routes, builtEntries, _sourceEntries) {
      const entry = builtEntries[0];
      const distDir = path.dirname(entry);
      const netlifyDir = await ensureDir(
        path.join(config.root, "netlify"),
        true
      );
      const esbuildOptionsFn: NetlifyBundlerOptions["manipulateEsbuildOptions"] =
        (options) => {
          options.minify = false;
          options.minifyIdentifiers = false;
          options.minifySyntax = false;
          options.minifyWhitespace = false;
        };

      for (const dir of [
        ".netlify/functions-serve",
        ".netlify/edge-functions",
      ]) {
        const dirpath = path.join(config.root, dir);
        if (existsSync(dirpath)) {
          fs.rm(dirpath, { recursive: true, force: true });
        }
      }

      if (options.edge) {
        const outDir = await ensureDir(path.join(netlifyDir, "edge-functions"));
        await bundleEdgeFunction(entry, outDir, esbuildOptionsFn);
        await writeEdgeFunctionManifest(config.root);
      } else {
        const outDir = await ensureDir(path.join(netlifyDir, "functions"));
        await bundleRegularFunction(entry, outDir, esbuildOptionsFn);
        await writeFunctionRedirects(config.root);
      }

      for (const dir of ["assets"]) {
        await fs.cp(path.join(distDir, dir), path.join(netlifyDir, dir), {
          recursive: true,
          force: true,
        });
      }
    },

    typeInfo(writer) {
      if (options.edge) {
        writer(
          `import type { NetlifyEdgePlatformInfo } from '@marko/run-adapter-netlify';`
        );
        return "NetlifyEdgePlatformInfo";
      }
      writer(
        `import type { NetlifyFunctionsPlatformInfo } from '@marko/run-adapter-netlify';`
      );
      return "NetlifyFunctionsPlatformInfo";
    },
  };
}

async function ensureDir(dir: string, clear?: boolean): Promise<string> {
  let exists = existsSync(dir);
  if (exists && clear) {
    await fs.rm(dir, { force: true, recursive: true });
    exists = false;
  }
  if (!exists) {
    await fs.mkdir(dir, { recursive: true });
  }
  return dir;
}

async function writeEdgeFunctionManifest(rootDir: string) {
  const dir = await ensureDir(path.join(rootDir, ".netlify", "edge-functions"));
  await fs.writeFile(
    path.join(dir, "manifest.json"),
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
}

async function writeFunctionRedirects(rootDir: string) {
  const dir = await ensureDir(path.join(rootDir, "netlify"));
  await fs.writeFile(
    path.join(dir, "_redirects"),
    "/*  /.netlify/functions/index  200\n",
    "utf-8"
  );
}

const devFlags = new RegExp(
  [
    "context=.+",
    "country=.+",
    "edge-inspect-brk(=.+)?",
    "edge-inspect(=.+)?",
    "functions=.+",
    "functions-port=.+",
    "geo=.+",
    "live",
    "offline",
    "session-id(=.+)?",
    "target-port=.+",
    "debug",
    "http-proxy(=.+)?",
    "http-proxy-certificate-filename(=.+)?",
  ]
    .map((flag) => {
      return `--${flag}`;
    })
    .join("|")
);

function parseNetlifyArgs(args: string[]) {
  return args.filter((arg) => devFlags.test(arg));
}

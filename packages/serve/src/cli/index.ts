#!/usr/bin/env node

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { InlineConfig, ResolvedConfig } from "vite";
import * as vite from "vite";
import sade from "sade";
import {
  getMarkoServeOptions,
  setMarkoServeOptions,
} from "../vite/utils/config";
import type { Adapter } from "../vite";
import { MemoryStore } from "@marko/vite";
import { spawnServer } from "../vite/utils/server";
import { loadBuildInfo } from "../vite/plugin";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cwd = process.cwd();
const defaultPort = +process.env.PORT! || 3000;
const defaultConfigFileBases = ["serve.config", "vite.config"];
const defaultConfigFileExts = [".js", ".cjs", ".mjs", ".ts", ".mts"];

const prog = sade("marko-serve")
  .version("0.0.1")
  .option("-c, --config", `Provide path to a Vite config file (by default looks for a file starting with ${defaultConfigFileBases.join(" or ")} with one of these extensions: ${defaultConfigFileExts.join(", ")})`);

prog
  .command("serve [entry]", "", { default: true })
  .describe("Start a production-like server for already-built app files")
  .option("-o, --output", "Directory to serve files from, and write asset files to if `--build` (default: )") // The awkwardness of this makes me wonder if instead the build command should have a `--serve` option?
  .option("-p, --port", "Port the server should listen on (defaults: `$PORT` env variable or 3000)")
  .option("-b, --build", "Build app before starting server")
  .action(async (entry, opts) => {
    const config = await getViteConfig(cwd, opts.config);
    if (opts.build) {
      const buildEntry =
        typeof opts.build === "string" ? opts.build : undefined;
      await build(buildEntry, config, opts.output);
    }

    const cmd = opts._.length ? `${entry} ${opts._.join(" ")}` : undefined;
    await serve(cmd ? undefined : entry, cmd, config, opts.port, opts.output);
  });

prog
  .command("dev [entry]")
  .describe("Start development server in watch mode")
  .option("-p, --port", "Port the dev server should listen on (defaults: 'preview.port' in config, or `$PORT` env variable, or 3000)")
  .example("dev --config vite.config.js")
  .action(async (entry, opts) => {
    const cmd = opts._.length
      ? `${entry} ${opts._.join(" ")}`
      : entry
      ? `node ${entry}`
      : undefined;
    const config = await getViteConfig(cwd, opts.config);
    await dev(cmd, config, opts.port);
  });

prog
  .command("build [entry]")
  .describe("Build the application (without serving it)")
  .option("-o, --output", "Directory to write built files (default: )")
  .option("--skip-client", "Skip the client-side build")
  .example("build --config vite.config.js")
  .action(async (entry, opts) => {
    const config = await getViteConfig(cwd, opts.config);
    await build(entry, config, opts.ouput, opts["skip-client"]);
  });

prog.parse(process.argv);

async function serve(
  entry: string | undefined,
  cmd: string | undefined,
  configFile: string,
  port?: number,
  outDir?: string
) {
  let config = outDir ? { configFile, build: { outDir } } : configFile;
  const resolvedConfig = await resolveConfig(config, "serve");

  if (port === undefined) {
    port = resolvedConfig.preview.port ?? defaultPort;
  }

  const adapter = await resolveAdapter(resolvedConfig);
  
  if (!adapter) {
    throw new Error("No adapter specified for 'serve' command");
  } else if (!adapter.startPreview) {
    throw new Error(`Adapter ${adapter.name} does not support 'serve' command`);
  }

  const dir = path.resolve(cwd, resolvedConfig.build.outDir);
  const buildInfo = await loadBuildInfo(dir);
  const entryFile = path.join(dir, entry || buildInfo.entryFile);
  await adapter.startPreview(dir, entryFile, cmd, port);
}

async function dev(cmd: string | undefined, configFile: string, port?: number) {
  const resolvedConfig = await resolveConfig(configFile);

  if (port === undefined) {
    port = resolvedConfig.preview.port ?? defaultPort;
  }

  if (cmd) {
    await spawnServer(cmd, port);
  } else {
    const adapter = await resolveAdapter(resolvedConfig);
    if (!adapter) {
      throw new Error(
        "No adapter specified for 'dev' command without custom target" // Would the user know what a target is if presented with this error?
      );
    } else if (!adapter.startDev) {
      throw new Error(`Adapter '${adapter.name}' does not support 'serve' command`);
    } else {
      await adapter.startDev(port);
    }
  }
}

async function build(
  entry: string | undefined,
  configFile: string,
  outDir?: string,
  skipClient: boolean = false
) {
  if (!entry) {
    const resolvedConfig = await resolveConfig(configFile);
    const adapter = await resolveAdapter(resolvedConfig);

    if (!adapter) {
      throw new Error("No adapter specified for building without an entry"); // How should we suggest the user sets an entry for this error and others like it?
    }

    entry = await adapter.getEntryFile?.();

    if (!entry) {
      throw new Error(
        `Adapter '${adapter.name}' does not support building without an entry`
      );
    }
  }

  const buildConfig = setMarkoServeOptions(
    {
      root: cwd,
      configFile,
      build: {
        ssr: false,
        outDir,
      },
    },
    {
      store: new MemoryStore(),
    }
  );

  // build SSR
  await vite.build({
    ...buildConfig,
    build: {
      ...buildConfig.build,
      ssr: entry,
    },
  });

  // build client
  if (!skipClient) {
    await vite.build({
      ...buildConfig,
      build: {
        ...buildConfig.build,
        sourcemap: true,
      },
    });
  }
}

function findFileWithExt(
  dir: string,
  base: string,
  extensions: string[] = defaultConfigFileExts
): string | undefined {
  for (const ext of extensions) {
    const filePath = path.join(dir, base + ext);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return undefined;
}

async function getViteConfig(
  dir: string,
  configFile?: string,
  bases: string[] = defaultConfigFileBases
): Promise<string> {
  if (configFile) {
    const configFilePath = path.join(dir, configFile);
    if (!fs.existsSync(configFilePath)) {
      throw new Error(`No config file found at '${configFilePath}'`);
    }
    console.info(`Using config file '${configFile}'`);
    return configFile;
  }

  for (const base of bases) {
    configFile = findFileWithExt(dir, base);
    if (configFile) {
      console.log(`Found config file '${configFile}'`);
      return configFile;
    }
  }

  console.info(`No user config file found`);
  return path.join(__dirname, "default.config.mjs");
}

async function resolveConfig(
  configFile: string | InlineConfig,
  command: "serve" | "build" = "build"
) {
  const config = typeof configFile === "string" ? { configFile } : configFile;
  return await vite.resolveConfig({ root: cwd, ...config }, command);
}

async function resolveAdapter(
  config: ResolvedConfig
): Promise<Adapter | undefined> {
  const options = getMarkoServeOptions(config);
  if (!options) {
    throw new Error("Unable to resolve @marko/serve options");
  }
  return options.adapter;
}

function packageIsInstalled(name: string) {
  try {
    const path = require.resolve(name);
    return fs.existsSync(path);
  } catch (e) {
    return false;
  }
}

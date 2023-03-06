#!/usr/bin/env node

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { build as viteBuild, resolveConfig, type ResolvedConfig } from "vite";
import sade from "sade";
import {
  getExternalPluginOptions,
  setExternalAdapterOptions,
  setExternalPluginOptions,
} from "../vite/utils/config";
import type { Adapter } from "../vite";
import { MemoryStore } from "@marko/vite";
import { spawnServer } from "../vite/utils/server";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cwd = process.cwd();
const defaultPort = +process.env.PORT! || 3000;
const defaultConfigFileBases = ["serve.config", "vite.config"];
const defaultConfigFileExts = [".js", ".cjs", ".mjs", ".ts", ".mts"];

const prog = sade("marko-run")
  .version("0.0.1")
  .option("-c, --config", `Provide path to a Vite config file (by default looks for a file starting with ${defaultConfigFileBases.join(" or ")} with one of these extensions: ${defaultConfigFileExts.join(", ")})`)
  .option("-e, --env", "Provide path to a dotenv file");

prog
  .command("preview [entry]")
  .describe("Start a production-like server for already-built app files")
  .option("-o, --output", "Directory to serve files from, and write asset files to if `--build` (default: )") // The awkwardness of this makes me wonder if instead the build command should have a `--serve` option?
  .option("-p, --port", "Port the server should listen on (defaults: `$PORT` env variable or 3000)")
  .option("-f, --file", "Output file to start")
  .action(async (entry, opts) => {
    process.env.NODE_ENV = "production";
    const config = await getViteConfig(cwd, opts.config);
    await build(entry, config, opts.output, false, opts.env);
    await preview(opts.entry, config, opts.port, opts.output, opts.env);
  });

prog
  .command("dev [entry]", "", { default: true })
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
    await dev(cmd, config, opts.port, opts.env);
  });

prog
  .command("build [entry]")
  .describe("Build the application (without serving it)")
  .option("-o, --output", "Directory to write built files (default: 'build.outDir' in Vite config)")
  .option("--skip-client", "Skip the client-side build")
  .example("build --config vite.config.js")
  .action(async (entry, opts) => {
    process.env.NODE_ENV = "production";
    const config = await getViteConfig(cwd, opts.config);
    await build(entry, config, opts.ouput, opts["skip-client"], opts.env);
  });

prog.parse(process.argv);

async function preview(
  entry: string | undefined,
  configFile: string,
  port?: number,
  outDir?: string,
  envFile?: string
) {
  const resolvedConfig = await resolveConfig(
    { root: cwd, configFile, build: { outDir } },
    "serve"
  );

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
  const entryFile = entry
    ? path.join(dir, entry)
    : await findFileWithExt(dir, "index", [".mjs", ".js"]);
  if (envFile) {
    envFile = path.resolve(cwd, envFile);
  }

  await adapter.startPreview(dir, entryFile, port, envFile);
}

async function dev(
  cmd: string | undefined,
  configFile: string,
  port?: number,
  envFile?: string
) {
  const resolvedConfig = await resolveConfig(
    { root: cwd, configFile },
    "build"
  );

  if (port === undefined) {
    port = resolvedConfig.preview.port ?? defaultPort;
  }
  if (envFile) {
    envFile = path.resolve(cwd, envFile);
  }

  if (cmd) {
    await spawnServer(cmd, port, envFile);
  } else {
    const adapter = await resolveAdapter(resolvedConfig);
    if (!adapter) {
      throw new Error(
        "No adapter specified for 'dev' command without custom target" // Would the user know what a target is if presented with this error?
      );
    } else if (!adapter.startDev) {
      throw new Error(`Adapter '${adapter.name}' does not support 'serve' command`);
    } else {
      await adapter.startDev(configFile, port!, envFile);
    }
  }
}

async function build(
  entry: string | undefined,
  configFile: string,
  outDir?: string,
  skipClient: boolean = false,
  envFile?: string
) {
  const resolvedConfig = await resolveConfig(
    { root: cwd, configFile },
    "build"
  );
  const adapter = await resolveAdapter(resolvedConfig);

  if (!adapter) {
    throw new Error("No adapter specified for build command without entry"); // How should we suggest the user sets an entry for this error and others like it?
  }

  if (!entry) {
    entry = await adapter.getEntryFile?.();

    if (!entry) {
      throw new Error(
        `Adapter '${adapter.name}' does not support building without an entry`
      );
    }
  }

  if (envFile) {
    envFile = path.resolve(cwd, envFile);
  }

  let buildConfig = {
    root: cwd,
    configFile,
    build: {
      ssr: false,
      outDir,
    },
  };

  buildConfig = setExternalPluginOptions(buildConfig, {
    store: new MemoryStore(),
  });

  buildConfig = setExternalAdapterOptions(buildConfig, {
    envFile,
  });

  // build SSR
  await viteBuild({
    ...buildConfig,
    build: {
      target: "esnext",
      ...buildConfig.build,
      ssr: entry,
      rollupOptions: {
        output: {
          entryFileNames: "index.mjs", // Would rather build with `.js` extension but that will fail in zero-config projects where node runs in cjs mode
        },
      },
    },
  });

  // build client
  if (!skipClient) {
    await viteBuild({
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
    return configFile;
  }

  for (const base of bases) {
    configFile = findFileWithExt(dir, base);
    if (configFile) {
      //console.log(`Found config file '${configFile}'`);
      return configFile;
    }
  }
  
  return path.join(__dirname, "default.config.mjs");
}

async function resolveAdapter(
  config: ResolvedConfig
): Promise<Adapter | undefined> {
  const options = getExternalPluginOptions(config);
  if (!options) {
    throw new Error("Unable to resolve @marko/serve options");
  }
  return options.adapter;
}

#!/usr/bin/env node

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { build as viteBuild, resolveConfig, type ResolvedConfig } from "vite";
import sade from "sade";
import {
  getMarkoServeOptions,
  setMarkoServeOptions,
} from "../vite/utils/config";
import type { Adapter } from "../vite";
import { MemoryStore } from "@marko/vite";
import { spawnServer } from "../vite/utils/server";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cwd = process.cwd();
const defaultPort = +process.env.PORT! || 3000;

const prog = sade("marko-run")
  .version("0.0.1")
  .option("-c, --config", "Provide path to a Vite config");

prog
  .command("preview [entry]", "", { default: true })
  .describe("Start production-like server against built assets")
  .option("-o, --output", "Directory to serve files")
  .option("-p, --port", "Port to use for dev server")
  .option("-f, --file", "Output file to start")
  .action(async (entry, opts) => {
    const config = await getViteConfig(cwd, opts.config);
    await build(entry, config, opts.output);
    await preview(opts.entry, config, opts.port, opts.output);
  });

prog
  .command("dev [entry]")
  .describe("Start dev server")
  .option("-p, --port", "Port to use for dev server")
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
  .describe("Build the application")
  .option("-o, --output", "Directory to ouput built files")
  .option("--skip-client", "Skip the client build")
  .example("build --config vite.config.js")
  .action(async (entry, opts) => {
    const config = await getViteConfig(cwd, opts.config);
    await build(entry, config, opts.ouput, opts["skip-client"]);
  });

prog.parse(process.argv);

async function preview(
  entry: string | undefined,
  configFile: string,
  port?: number,
  outDir?: string
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
    throw new Error("No adapter specified for serve command");
  } else if (!adapter.startPreview) {
    throw new Error(`Adapter ${adapter.name} does not support serve command`);
  }

  const dir = path.resolve(cwd, resolvedConfig.build.outDir);
  const entryFile = entry ? path.join(dir, entry) : await findFileWithExt(dir, "index", [".mjs", ".js"]);
  await adapter.startPreview(dir, entryFile, port);
}

async function dev(cmd: string | undefined, configFile: string, port?: number) {
  const resolvedConfig = await resolveConfig(
    { root: cwd, configFile },
    "build"
  );

  if (port === undefined) {
    port = resolvedConfig.preview.port ?? defaultPort;
  }

  if (cmd) {
    await spawnServer(cmd, port);
  } else {
    const adapter = await resolveAdapter(resolvedConfig);
    if (!adapter) {
      throw new Error(
        "No adapter specified for dev command without custom target"
      );
    } else if (!adapter.startDev) {
      throw new Error(`Adapter ${adapter.name} does not support serve command`);
    } else {
      await adapter.startDev(configFile, port!);
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
    const resolvedConfig = await resolveConfig(
      { root: cwd, configFile },
      "build"
    );
    const adapter = await resolveAdapter(resolvedConfig);

    if (!adapter) {
      throw new Error("No adapter specified for build command without entry");
    }

    entry = await adapter.getEntryFile?.();

    if (!entry) {
      throw new Error(
        `Adapter ${adapter.name} does not support build command without entry`
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
  await viteBuild({
    ...buildConfig,
    build: {
      ...buildConfig.build,
      ssr: entry,
      rollupOptions: {
        output: {
          entryFileNames: 'index.mjs', // Would rather build with `.js` extension but that will fail in zero-config projects where node runs in cjs mode
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
  extensions: string[] = [".js", ".cjs", ".mjs", ".ts", ".mts"]
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
  bases: string[] = ["serve.config", "vite.config"]
): Promise<string> {
  if (configFile) {
    if (!fs.existsSync(path.join(dir, configFile))) {
      throw new Error(`Unable to load config file '${configFile}' from ${dir}`);
    }
    //console.log(`Using config file '${configFile}'`);
    return configFile;
  }

  for (const base of bases) {
    configFile = findFileWithExt(dir, base);
    if (configFile) {
      //console.log(`Found config file '${configFile}'`);
      return configFile;
    }
  }

  //console.log(`No user config file was found`);
  return path.join(__dirname, "default.config.mjs");
}

async function resolveAdapter(
  config: ResolvedConfig
): Promise<Adapter | undefined> {
  const options = getMarkoServeOptions(config);
  if (!options) {
    throw new Error("Unable to resolve Marko Serve options");
  }
  return options.adapter;
}
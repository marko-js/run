#!/usr/bin/env node

import sade from "sade";
import {
  build,
  dev,
  preview,
  getViteConfig,
  defaultConfigFileBases,
  defaultConfigFileExts,
} from "./commands";

const prog = sade("marko-run")
  .version("0.0.1")
  .option(
    "-c, --config",
    `Provide path to a Vite config file (by default looks for a file starting with ${defaultConfigFileBases.join(
      " or "
    )} with one of these extensions: ${defaultConfigFileExts.join(", ")})`
  )
  .option("-e, --env", "Provide path to a dotenv file");

prog
  .command("preview [entry]")
  .describe("Start a production-like server for already-built app files")
  .option(
    "-o, --output",
    "Directory to serve files from, and write asset files to if `--build` (default: 'build.outDir' in Vite config)"
  )
  .option(
    "-p, --port",
    "Port the server should listen on (defaults: `$PORT` env variable or 3000)"
  )
  .option("-f, --file", "Output file to start")
  .action(async (entry, opts) => {
    process.env.NODE_ENV = "production";
    const cwd = process.cwd();
    const args = process.argv.slice(entry ? 4 : 3);
    const config = await getViteConfig(cwd, opts.config);
    await build(entry, cwd, config, opts.output, opts.env);
    await preview(
      entry,
      opts.file,
      cwd,
      config,
      opts.port,
      opts.output,
      opts.env,
      args
    );
  });

prog
  .command("dev [entry]", "", { default: true })
  .describe("Start development server in watch mode")
  .option(
    "-p, --port",
    "Port the dev server should listen on (defaults: 'preview.port' in config, or `$PORT` env variable, or 3000)"
  )
  .example("dev --config vite.config.js")
  .action(async (entry, opts) => {
    const cwd = process.cwd();
    const offset = (process.argv[2] === 'dev' ? 3 : 2) + (entry ? 1 : 0);
    const args = process.argv.slice(offset);
    const config = await getViteConfig(cwd, opts.config);
    await dev(entry, cwd, config, opts.port, opts.env, args);
  });

prog
  .command("build [entry]")
  .describe("Build the application (without serving it)")
  .option(
    "-o, --output",
    "Directory to write built files (default: 'build.outDir' in Vite config)"
  )
  .example("build --config vite.config.js")
  .action(async (entry, opts) => {
    const cwd = process.cwd();
    const config = await getViteConfig(cwd, opts.config);
    await build(entry, cwd, config, opts.output, opts.env);
  });

prog.parse(process.argv);

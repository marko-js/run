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
    "Directory to serve files from, and write asset files to if `--build` (default: )"
  ) // The awkwardness of this makes me wonder if instead the build command should have a `--serve` option?
  .option(
    "-p, --port",
    "Port the server should listen on (defaults: `$PORT` env variable or 3000)"
  )
  .option("-f, --file", "Output file to start")
  .action(async (entry, opts) => {
    process.env.NODE_ENV = "production";
    const cwd = process.cwd();
    const config = await getViteConfig(cwd, opts.config);
    await build(entry, cwd, config, opts.output, false, opts.env);
    await preview(opts.file, cwd, config, opts.port, opts.output, opts.env);
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
    const cmd = opts._.length
      ? `${entry} ${opts._.join(" ")}`
      : entry
      ? `node ${entry}`
      : undefined;
    const cwd = process.cwd();
    const config = await getViteConfig(cwd, opts.config);
    await dev(cmd, cwd, config, opts.port, opts.env);
  });

prog
  .command("build [entry]")
  .describe("Build the application (without serving it)")
  .option(
    "-o, --output",
    "Directory to write built files (default: 'build.outDir' in Vite config)"
  )
  .option("--skip-client", "Skip the client-side build")
  .example("build --config vite.config.js")
  .action(async (entry, opts) => {
    process.env.NODE_ENV = "production";
    const cwd = process.cwd();
    const config = await getViteConfig(cwd, opts.config);
    await build(entry, cwd, config, opts.ouput, opts["skip-client"], opts.env);
  });

prog.parse(process.argv);

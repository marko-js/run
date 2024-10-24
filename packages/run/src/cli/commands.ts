#!/usr/bin/env node

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  build as viteBuild,
  resolveConfig,
  type ResolvedConfig,
  InlineConfig,
} from "vite";
import {
  getExternalPluginOptions,
  setExternalAdapterOptions,
} from "../vite/utils/config";
import type { Adapter } from "../vite";
import { getAvailablePort, type SpawnedServer } from "../vite/utils/server";
import {
  default as plugin,
  resolveAdapter as pluginResolveAdapter,
  isPluginIncluded,
} from "../vite/plugin";
import type { StartDevOptions, StartPreviewOptions } from "../vite/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPort = Number(process.env.PORT || 3000);

export const defaultConfigFileBases = ["serve.config", "vite.config"];
export const defaultConfigFileExts = [".js", ".cjs", ".mjs", ".ts", ".mts"];

export async function preview(
  entry: string | undefined,
  distEntry: string | undefined,
  cwd: string,
  configFile: string,
  port?: number,
  outDir?: string,
  envFile?: string,
  args: string[] = []
): Promise<SpawnedServer> {
  const resolvedConfig = await resolveConfig(
    { root: cwd, configFile, logLevel: "silent", build: { outDir } },
    "serve"
  );

  const [availablePort, adapter] = await Promise.all([
    getAvailablePort(
      port ??
        resolvedConfig.preview.port ??
        resolvedConfig.server.port ??
        defaultPort
    ),
    resolveAdapter(resolvedConfig),
  ]);

  if (!adapter) {
    throw new Error("No adapter specified for 'serve' command");
  } else if (!adapter.startPreview) {
    throw new Error(`Adapter ${adapter.name} does not support 'serve' command`);
  }

  if (!entry) {
    entry = await adapter.getEntryFile?.();
  }

  const dir = path.resolve(cwd, resolvedConfig.build.outDir);
  const entryFile = distEntry
    ? path.join(dir, distEntry)
    : await findFileWithExt(dir, "index", [".mjs", ".js"]);
  if (envFile) {
    envFile = path.resolve(cwd, envFile);
  }

  const options: StartPreviewOptions = {
    cwd,
    dir,
    args,
    port: availablePort,
    envFile,
    entry,
  };

  return await adapter.startPreview(entryFile, options);
}

export async function dev(
  entry: string | undefined,
  cwd: string,
  configFile: string,
  port?: number,
  envFile?: string,
  args: string[] = []
): Promise<SpawnedServer> {
  const resolvedConfig = await resolveConfig(
    { root: cwd, configFile, logLevel: "silent" },
    "serve"
  );

  if (envFile) {
    envFile = path.resolve(cwd, envFile);
  }

  const [availablePort, adapter] = await Promise.all([
    getAvailablePort(
      port ??
        resolvedConfig.server.port ??
        resolvedConfig.preview.port ??
        defaultPort
    ),
    resolveAdapter(resolvedConfig),
  ]);

  if (!adapter) {
    throw new Error(
      "No adapter specified for 'dev' command without custom target" // Would the user know what a target is if presented with this error?
    );
  } else if (!adapter.startDev) {
    throw new Error(`Adapter '${adapter.name}' does not support 'dev' command`);
  }

  if (!entry) {
    entry = await adapter.getEntryFile?.();
  }

  const config: InlineConfig = {
    root: cwd,
    configFile,
    plugins: isPluginIncluded(resolvedConfig) ? undefined : plugin(),
  };

  const options: StartDevOptions = {
    cwd,
    args,
    port: availablePort,
    envFile,
  };

  return await adapter.startDev(entry, config, options);
}

export async function build(
  entry: string | undefined,
  cwd: string,
  configFile: string,
  outDir?: string,
  envFile?: string
) {
  const root = cwd;
  const resolvedConfig = await resolveConfig(
    { root, configFile, logLevel: "silent" },
    "build",
    "production",
    "production"
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

  const buildConfig = setExternalAdapterOptions(
    {
      root,
      configFile,
      plugins: isPluginIncluded(resolvedConfig) ? undefined : plugin(),
      build: {
        ssr: false,
        outDir,
      },
    },
    {
      root,
      isBuild: true,
      envFile,
    }
  );


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
  await viteBuild({
    ...buildConfig,
    build: {
      ...buildConfig.build,
      sourcemap: true,
    },
  });
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

export async function getViteConfig(
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
      return configFile;
    }
  }

  return path.join(__dirname, "default.config.mjs");
}

async function resolveAdapter(config: ResolvedConfig): Promise<Adapter | null> {
  const options = getExternalPluginOptions(config);
  return pluginResolveAdapter(config.root, options);
}

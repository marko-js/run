#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  build as viteBuild,
  type InlineConfig,
  resolveConfig,
  type ResolvedConfig,
} from "vite";

import type { Adapter } from "../vite";
import {
  default as plugin,
  defaultConfigPlugin,
  defaultPort,
  isPluginIncluded,
  resolveAdapter as pluginResolveAdapter,
} from "../vite/plugin";
import type { StartDevOptions, StartPreviewOptions } from "../vite/types";
import {
  getExternalPluginOptions,
  setExternalAdapterOptions,
} from "../vite/utils/config";
import { getAvailablePort, type SpawnedServer } from "../vite/utils/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const defaultConfigFileBases = ["vite.config"];
export const defaultConfigFileExts = [".js", ".cjs", ".mjs", ".ts", ".mts"];

export async function preview(
  entry: string | undefined,
  distEntry: string | undefined,
  cwd: string,
  configFile: string,
  port?: number,
  outDir?: string,
  envFile?: string,
  args: string[] = [],
): Promise<SpawnedServer> {
  const resolvedConfig = await resolveConfig(
    {
      root: cwd,
      configFile,
      logLevel: "silent",
      build: { outDir },
      plugins: [defaultConfigPlugin],
    },
    "serve",
  );

  const [availablePort, adapter] = await Promise.all([
    getAvailablePort(
      port ??
        resolvedConfig.preview.port ??
        resolvedConfig.server.port ??
        defaultPort,
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
    : findFileWithExt(dir, "index", [".mjs", ".js"]);
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

  return await adapter.startPreview({
    entry: entryFile,
    options,
  });
}

export async function dev(
  entry: string | undefined,
  cwd: string,
  configFile: string,
  port?: number,
  envFile?: string,
  args: string[] = [],
): Promise<SpawnedServer> {
  const root = cwd;
  const resolvedConfig = await resolveConfig(
    {
      root,
      configFile,
      logLevel: "silent",
      plugins: [defaultConfigPlugin],
    },
    "serve",
  );

  if (envFile) {
    envFile = path.resolve(cwd, envFile);
  }

  const [availablePort, adapter] = await Promise.all([
    getAvailablePort(
      port ??
        resolvedConfig.server.port ??
        resolvedConfig.preview.port ??
        defaultPort,
    ),
    resolveAdapter(resolvedConfig),
  ]);

  if (!adapter) {
    throw new Error(
      "No adapter specified for 'dev' command without custom target", // Would the user know what a target is if presented with this error?
    );
  } else if (!adapter.startDev) {
    throw new Error(`Adapter '${adapter.name}' does not support 'dev' command`);
  }

  if (!entry) {
    entry = await adapter.getEntryFile?.();
  }

  let plugins =
    adapter.plugins && (await adapter.plugins({ root, command: "dev" }));
  if (!isPluginIncluded(resolvedConfig)) {
    plugins = (plugins || []).concat(plugin());
  }

  const config: InlineConfig = {
    root: cwd,
    configFile,
    plugins,
  };

  const options: StartDevOptions = {
    cwd,
    args,
    port: availablePort,
    envFile,
  };

  return await adapter.startDev({ entry, config, options });
}

export async function build(
  entry: string | undefined,
  cwd: string,
  configFile: string,
  outDir?: string,
  envFile?: string,
) {
  const root = cwd;
  const resolvedConfig = await resolveConfig(
    { root, configFile, logLevel: "silent", plugins: [defaultConfigPlugin] },
    "build",
    "production",
    "production",
  );
  const adapter = await resolveAdapter(resolvedConfig);

  if (!adapter) {
    throw new Error("No adapter specified for build command without entry"); // How should we suggest the user sets an entry for this error and others like it?
  }

  if (!entry) {
    entry = await adapter.getEntryFile?.();

    if (!entry) {
      throw new Error(
        `Adapter '${adapter.name}' does not support building without an entry`,
      );
    }
  }

  if (envFile) {
    envFile = path.resolve(cwd, envFile);
  }

  let plugins =
    adapter.plugins && (await adapter.plugins({ root, command: "build" }));
  if (!isPluginIncluded(resolvedConfig)) {
    plugins = (plugins || []).concat(plugin());
  }

  const buildConfig = setExternalAdapterOptions<InlineConfig>(
    {
      root,
      configFile,
      plugins,
      build: {
        ssr: false,
        outDir,
      },
    },
    {
      root,
      isBuild: true,
      envFile,
    },
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
  });
}

function findFileWithExt(
  dir: string,
  base: string,
  extensions: string[] = defaultConfigFileExts,
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
  bases: string[] = defaultConfigFileBases,
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

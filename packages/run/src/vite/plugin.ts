import path from "path";
import fs from "fs";
import { glob } from "glob";
import { fileURLToPath } from "url";
import browserslist from "browserslist";
import { resolveToEsbuildTarget } from "esbuild-plugin-browserslist";
import { buildErrorMessage, mergeConfig } from "vite";
import type {
  ViteDevServer,
  Plugin,
  ResolvedConfig,
  UserConfig,
  ModuleNode,
} from "vite";
import type { PluginContext, OutputOptions } from "rollup";
import markoVitePlugin from "@marko/vite";
import { buildRoutes, matchRoutableFile } from "./routes/builder";
import { createFSWalker } from "./routes/walk";
import type {
  Options,
  Adapter,
  BuiltRoutes,
  HttpVerb,
  PackageData,
  RouterOptions,
} from "./types";
import {
  renderMiddleware,
  renderRouteEntry,
  renderRouter,
  renderRouteTemplate,
  renderRouteTypeInfo,
} from "./codegen";
import {
  virtualFilePrefix,
  httpVerbs,
  serverEntryQuery,
  RoutableFileTypes,
  markoRunFilePrefix,
} from "./constants";
import { getExportIdentifiers, getViteSSRExportIdentifiers } from "./utils/ast";
import { logRoutesTable } from "./utils/log";
import {
  getExternalAdapterOptions,
  getExternalPluginOptions,
  setExternalPluginOptions,
} from "./utils/config";

// @ts-ignore
import createDebug from "debug";
import { ReadOncePersistedStore } from "./utils/read-once-persisted-store";
import { prepareError } from "../adapter/utils";

const debug = createDebug("@marko/run");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLUGIN_NAME_PREFIX = "marko-run-vite";
const POSIX_SEP = "/";
const WINDOWS_SEP = "\\";
const CLIENT_OUT_DIR = "public";

const normalizePath =
  path.sep === WINDOWS_SEP
    ? (id: string) => id.replace(/\\/g, POSIX_SEP)
    : (id: string) => id;

interface TimeMetrics {
  routesBuild: number;
  routesRender: number;
}

interface RouteData {
  routes: BuiltRoutes;
  files: { key: string; code: string }[];
  times: TimeMetrics;
  builtEntries: string[];
  sourceEntries: string[];
}

export default function markoRun(opts: Options = {}): Plugin[] {
  let { routesDir, adapter, ...markoVitePluginOptions } = opts;

  let store: ReadOncePersistedStore<RouteData>;
  let root: string;
  let resolvedRoutesDir: string;
  let typesDir: string;
  let isBuild = false;
  let isSSRBuild = false;
  let tsConfigExists: boolean | undefined;
  let ssrEntryFiles: string[];
  let devEntryFile: string;
  let devEntryFilePosix: string;
  let devServer: ViteDevServer;
  let routes: BuiltRoutes;
  let routeData!: RouteData;
  let getExportsFromFile: (
    context: PluginContext,
    filePath: string,
  ) => Promise<string[]>;
  let resolvedConfig: ResolvedConfig;
  let typesFile: string | undefined;
  let seenErrors = new Set<string>();

  const virtualFiles = new Map<string, string>();

  let times: TimeMetrics = {
    routesBuild: 0,
    routesRender: 0,
  };

  async function writeTypesFile(routes: BuiltRoutes) {
    if (
      routes &&
      (tsConfigExists ??= await globFileExists(
        root,
        "{.tsconfig*,tsconfig*.json}",
      ))
    ) {
      const filepath = path.join(typesDir, "routes.d.ts");

      const data = await renderRouteTypeInfo(
        routes,
        normalizePath(path.relative(typesDir, resolvedRoutesDir)),
        adapter,
      );

      if (data !== typesFile || !fs.existsSync(filepath)) {
        await ensureDir(typesDir);
        await fs.promises.writeFile(filepath, (typesFile = data));
      }
    }
  }

  let buildVirtualFilesResult: Promise<BuiltRoutes> | undefined;
  function buildVirtualFiles() {
    return (buildVirtualFilesResult ??= new Promise(async (resolve, reject) => {
      try {
        // const sources: RouteSource[] = [];

        // if (true) {
        //   const explorerRoutesDir = path.resolve(__dirname, '../components/routes-explorer');
        //   const explorerImportPrefix = path.relative(root, explorerRoutesDir);
        //   sources.push({
        //     walker: createFSWalker(explorerRoutesDir),
        //     importPrefix: explorerImportPrefix,
        //     basePath: '_route-explorer.%2Broutes'
        //   });
        // }
        virtualFiles.clear();
        routes = await buildRoutes({
          walker: createFSWalker(resolvedRoutesDir),
          importPrefix: routesDir,
        });
        if (!routes.list.length) {
          throw new Error("No routes generated");
        }

        for (const route of routes.list) {
          if (route.page) {
            virtualFiles.set(
              path.posix.join(root, `${route.entryName}.marko`),
              "",
            );
          }
          virtualFiles.set(path.posix.join(root, `${route.entryName}.js`), "");
        }
        for (const route of Object.values(routes.special)) {
          virtualFiles.set(
            path.posix.join(root, `${route.entryName}.marko`),
            "",
          );
        }
        if (routes.middleware.length) {
          virtualFiles.set(
            path.posix.join(root, `${markoRunFilePrefix}middleware.js`),
            "",
          );
        }
        virtualFiles.set("@marko/run/router", "");

        resolve(routes);
      } catch (err) {
        reject(err);
      }
    }));
  }

  let renderVirtualFilesResult: Promise<void> | undefined;
  function renderVirtualFiles(context: PluginContext) {
    return (renderVirtualFilesResult ??= new Promise<void>(async (resolve) => {
      const routerOptions: RouterOptions = {
        trailingSlashes: opts.trailingSlashes || "RedirectWithout",
      };
      try {
        const routes = await buildVirtualFiles();

        for (const route of routes.list) {
          if (route.handler) {
            const exports = await getExportsFromFile(
              context,
              route.handler.filePath,
            );
            route.handler.verbs = [];
            for (const name of exports) {
              const verb = name.toLowerCase() as HttpVerb;
              if (name === verb.toUpperCase() && httpVerbs.includes(verb)) {
                route.handler.verbs.push(verb);
              }
            }
            if (!route.handler.verbs.length) {
              context.warn(
                `Did not find any http verb exports in handler '${path.relative(root, route.handler.filePath)}' - expected ${httpVerbs.map((v) => v.toUpperCase()).join(", ")}`,
              );
            }
          }

          if (route.page) {
            virtualFiles.set(
              path.posix.join(root, `${route.entryName}.marko`),
              renderRouteTemplate(route),
            );
          }
          virtualFiles.set(
            path.posix.join(root, `${route.entryName}.js`),
            renderRouteEntry(route),
          );
        }
        for (const route of Object.values(routes.special)) {
          virtualFiles.set(
            path.posix.join(root, `${route.entryName}.marko`),
            renderRouteTemplate(route),
          );
        }
        if (routes.middleware.length) {
          for (const middleware of routes.middleware) {
            if (
              !(
                await getExportsFromFile(context, middleware.filePath)
              ).includes("default")
            ) {
              context.warn(
                `Did not find a default export in middleware '${path.relative(root, middleware.filePath)}'`,
              );
            }
          }

          virtualFiles.set(
            path.posix.join(root, `${markoRunFilePrefix}middleware.js`),
            renderMiddleware(routes.middleware),
          );
        }
        virtualFiles.set(
          "@marko/run/router",
          renderRouter(routes, routerOptions),
        );

        await writeTypesFile(routes);
        if (adapter?.routesGenerated) {
          await adapter.routesGenerated(
            routes,
            new Map(virtualFiles.entries()),
            {
              buildTime: times.routesBuild,
              renderTime: times.routesRender,
            },
          );
          if (!isBuild) {
            await opts?.emitRoutes?.(routes.list);
          }
        }
      } catch (err) {
        if (isBuild) {
          throw err;
        }
        virtualFiles.set(
          "@marko/run/router",
          `throw ${JSON.stringify(prepareError(err as Error))}`,
        );
      }

      resolve();
    }));
  }

  return [
    {
      name: `${PLUGIN_NAME_PREFIX}:pre`,
      enforce: "pre",
      async config(config, env) {
        const externalPluginOptions = getExternalPluginOptions(config);
        if (externalPluginOptions) {
          opts = mergeConfig(opts, externalPluginOptions);
        }

        root = normalizePath(config.root || process.cwd());
        isBuild = env.command === "build";
        isSSRBuild = isBuild && Boolean(config.build?.ssr);
        adapter = await resolveAdapter(
          root,
          opts,
          (config.logLevel !== "silent" && !isBuild) || isSSRBuild,
        );

        if (adapter) {
          adapter.configure?.({
            ...getExternalAdapterOptions(config),
            root,
            isBuild,
          });
          const adapterOptions = await adapter.pluginOptions?.(opts);
          if (adapterOptions) {
            opts = mergeConfig(opts, adapterOptions);
          }
        }

        routesDir = opts.routesDir || "src/routes";
        store = new ReadOncePersistedStore(
          `vite-marko-run${opts.runtimeId ? `-${opts.runtimeId}` : ""}`,
        );
        markoVitePluginOptions.runtimeId = opts.runtimeId;
        markoVitePluginOptions.basePathVar = opts.basePathVar;
        resolvedRoutesDir = path.resolve(root, routesDir);
        typesDir = path.join(root, ".marko-run");
        devEntryFile = path.join(root, "index.html");
        devEntryFilePosix = normalizePath(devEntryFile);

        let outDir = config.build?.outDir || "dist";
        const assetsDir = config.build?.assetsDir || "assets";
        let rollupOutputOptions = config.build?.rollupOptions?.output;

        if (isBuild) {
          if (!isSSRBuild) {
            outDir = path.join(outDir, CLIENT_OUT_DIR)
          }

          const defaultRollupOutputOptions: OutputOptions = {
            assetFileNames({ name }) {
              if (name && name.indexOf("_marko-virtual_id_") < 0) {
                return `${assetsDir}/${
                  getEntryFileName(name) || "[name]"
                }-[hash].[ext]`;
              }
              return `${assetsDir}/_[hash].[ext]`;
            },
            entryFileNames(info) {
              let name = getEntryFileName(info.facadeModuleId);
              if (!name) {
                for (let id of info.moduleIds) {
                  name = getEntryFileName(id);
                  if (name) {
                    break;
                  }
                }
              }
              return `${assetsDir}/${name || "[name]"}-[hash].js`;
            },
            chunkFileNames: isSSRBuild
              ? `_[hash].js`
              : `${assetsDir}/_[hash].js`,
          };

          if (!rollupOutputOptions) {
            rollupOutputOptions = defaultRollupOutputOptions;
          } else if (!Array.isArray(rollupOutputOptions)) {
            rollupOutputOptions = {
              ...defaultRollupOutputOptions,
              ...rollupOutputOptions,
            };
          } else {
            rollupOutputOptions = rollupOutputOptions.map((options) => ({
              ...defaultRollupOutputOptions,
              ...options,
            }));
          }
        }

        const browserslistTarget =
          isBuild && !config.build?.target
            ? browserslist(undefined, {
                path: root,
              })
            : undefined;

        let pluginConfig: UserConfig = {
          logLevel: isBuild ? "warn" : undefined,
          define: isBuild
            ? {
                "process.env.NODE_ENV": "'production'"
              }
            : undefined,
          ssr: {
            noExternal: /@marko\/run($|\/)/,
          },
          css: {
            devSourcemap: true,
          },
          build: {
            outDir,
            assetsDir,
            target: browserslistTarget?.length
              ? resolveToEsbuildTarget(browserslistTarget, {
                  printUnknownTargets: false,
                })
              : undefined,
            emptyOutDir: isSSRBuild, // Avoid server & client deleting files from each other.
            copyPublicDir: !isSSRBuild,
            ssrEmitAssets: false,
            rollupOptions: {
              output: rollupOutputOptions,
            },
            modulePreload: { polyfill: false },
          },
          optimizeDeps: {
            entries: !config.optimizeDeps?.entries
              ? [
                  "src/pages/**/*+{page,layout}.marko",
                  "!**/__snapshots__/**",
                  `!**/__tests__/**`,
                  `!**/coverage/**`,
                ]
              : undefined,
          },
          resolve: isBuild
            ? {
                mainFields: (isSSRBuild ? [] : ["browser"]).concat([
                  "module",
                  "jsnext:main",
                  "jsnext",
                  "main",
                ]),
                conditions: [
                  isSSRBuild ? "node" : "browser",
                  "import",
                  "require",
                  "production",
                  "default",
                ],
              }
            : undefined,
        };

        if (adapter?.viteConfig) {
          const adapterConfig = await adapter.viteConfig(config);
          if (adapterConfig) {
            pluginConfig = mergeConfig(pluginConfig, adapterConfig);
          }
        }

        return setExternalPluginOptions(pluginConfig, opts);
      },
      configResolved(config) {
        resolvedConfig = config;
        const {
          ssr,
          rollupOptions: { input },
        } = config.build;
        if (typeof ssr === "string") {
          ssrEntryFiles = [ssr];
        } else if (typeof input === "string") {
          ssrEntryFiles = [input];
        } else if (Array.isArray(input)) {
          ssrEntryFiles = input;
        } else if (input) {
          ssrEntryFiles = Object.values(input);
        } else {
          ssrEntryFiles = [];
        }

        const baseError = config.logger.error;
        config.logger.error = function (msg, options) {
          if (!options?.error?.message) {
            baseError.call(this, msg, options);
          } else if (!seenErrors.has(options.error.message)) {
            seenErrors.add(options.error.message);
            console.error(buildErrorMessage(options.error));
          }
        };
      },
      configureServer(_server) {
        devServer = _server;
        devServer.watcher
          .on("all", async (type, filename) => {
            seenErrors.clear();
            const routableFileType = matchRoutableFile(
              path.parse(filename).base,
            );
            if (filename.startsWith(resolvedRoutesDir) && routableFileType) {
              if (
                type === "add" ||
                type === "unlink" ||
                (type === "change" &&
                  (routableFileType === RoutableFileTypes.Handler ||
                    routableFileType === RoutableFileTypes.Middleware))
              ) {
                buildVirtualFilesResult = undefined;
                renderVirtualFilesResult = undefined;

                const module = devServer.moduleGraph.getModuleById(filename);
                const importers = module && getImporters(module, filename);
                if (importers?.size) {
                  for (const file of importers) {
                    devServer.watcher.emit("change", file);
                  }
                } else {
                  for (const file of virtualFiles.keys()) {
                    if (!file.endsWith(".marko")) {
                      devServer.watcher.emit("change", file);
                    }
                  }
                }
              }
            }
          })
          .unwatch(typesDir + "/*");
      },
      async buildStart(_options) {
        if (isBuild && !isSSRBuild) {
          // Routes and code should have been generated in the SSR build that ran previously
          try {
            routeData = await store.read();
          } catch {
            this.error(
              `You must run the "ssr" build before the "browser" build.`,
            );
          }

          routes = routeData.routes;
          times = routeData.times;
          for (const { key, code } of routeData.files) {
            virtualFiles.set(key, code);
          }

          buildVirtualFilesResult = Promise.resolve(routes);
          renderVirtualFilesResult = Promise.resolve();
        } else {
          // Build routes and generate code
          getExportsFromFile = isBuild
            ? getExportsFromFileBuild
            : getExportsFromFileDev.bind(null, devServer);
        }
      },
      async resolveId(importee, importer) {
        let resolved: string | undefined;
        let virtualFilePath: string | undefined;
        if (importee.startsWith(virtualFilePrefix)) {
          virtualFilePath = importee.slice(virtualFilePrefix.length + 1);
          importee = path.resolve(root, virtualFilePath);
        } else if (
          !isBuild &&
          importer &&
          (importer === devEntryFile ||
            normalizePath(importer) === devEntryFilePosix) &&
          importee.startsWith(`/${markoRunFilePrefix}`)
        ) {
          importee = path.resolve(root, "." + importee);
        }

        importee = normalizePath(importee);

        if (!buildVirtualFilesResult) {
          await buildVirtualFiles();
        }
        if (virtualFiles.has(importee)) {
          resolved = importee;
        } else if (virtualFilePath) {
          const filePath = path.resolve(__dirname, "..", virtualFilePath);
          const resolution = await this.resolve(filePath, importer, {
            skipSelf: true,
          });
          return resolution;
        }

        return resolved || null;
      },
      async load(id) {
        if (id.endsWith(serverEntryQuery)) {
          id = id.slice(0, -serverEntryQuery.length);
        }
        if (!renderVirtualFilesResult) {
          await renderVirtualFiles(this);
        }
        if (virtualFiles.has(id)) {
          return virtualFiles.get(id)!;
        } else if (/[/\\]__marko-run__[^?/\\]+\.(js|marko)$/.exec(id)) {
          return "";
        }
      },
    },
    ...markoVitePlugin(markoVitePluginOptions),
    {
      name: `${PLUGIN_NAME_PREFIX}:post`,
      enforce: "post",
      generateBundle(options, bundle) {
        if (options.sourcemap && options.sourcemap !== "inline") {
          // Iterate through bundle and remove source maps that don't have a corresponding source file
          for (const key of Object.keys(bundle)) {
            if (key.endsWith(".map") && !bundle[key.slice(0, -4)]) {
              delete bundle[key];
            }
          }
        }
      },
      async writeBundle(options, bundle) {
        if (isSSRBuild) {
          const builtEntries = Object.values(bundle).reduce<string[]>(
            (acc, item) => {
              if (item.type === "chunk" && item.isEntry) {
                acc.push(path.join(options.dir!, item.fileName));
              }
              return acc;
            },
            [],
          );

          routeData = {
            routes,
            files: [],
            times,
            builtEntries,
            sourceEntries: ssrEntryFiles,
          };
          for (const [key, code] of virtualFiles) {
            routeData.files.push({ key, code });
          }

          store.write(routeData);

          await opts?.emitRoutes?.(routes.list);
        } else if (process.env.MR_EXPLORER !== "true") {
          logRoutesTable(routes, bundle, options);
        }
      },
      async closeBundle() {
        if (isBuild && !isSSRBuild && adapter?.buildEnd && routes) {
          await adapter.buildEnd(
            resolvedConfig,
            routes.list,
            routeData.builtEntries,
            routeData.sourceEntries,
          );
        }
      },
    },
  ];
}

async function getExportsFromFileBuild(
  context: PluginContext,
  filePath: string,
) {
  const result = await context.load({
    id: filePath,
    resolveDependencies: false,
  });
  return result ? getExportIdentifiers(result.ast) : [];
}

async function getExportsFromFileDev(
  devServer: ViteDevServer,
  context: PluginContext,
  filePath: string,
) {
  const result = await devServer.transformRequest(filePath, { ssr: true });
  if (result) {
    const ast = context.parse(result.code)
    return getViteSSRExportIdentifiers(ast);
  }
  return [];
}

async function globFileExists(root: string, pattern: string) {
  return (await glob(pattern, { root })).length > 0;
}

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

export async function getPackageData(dir: string): Promise<PackageData | null> {
  do {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      return JSON.parse(await fs.promises.readFile(pkgPath, "utf-8"));
    }
  } while (dir !== (dir = path.dirname(dir)));
  return null;
}

export async function resolveAdapter(
  root: string,
  options?: Options,
  log?: boolean,
): Promise<Adapter | null> {
  if (options && options.adapter !== undefined) {
    return options.adapter;
  }
  const pkg = await getPackageData(root);
  if (pkg) {
    let dependecies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
    if (pkg.devDependencies) {
      dependecies = dependecies.concat(Object.keys(pkg.devDependencies));
    }

    for (const name of dependecies) {
      if (
        name.startsWith("@marko/run-adapter") ||
        name.indexOf("marko-run-adapter") !== -1
      ) {
        try {
          const module = await import(name);
          log &&
            debug(
              `Using adapter ${name} listed in your package.json dependecies`,
            );
          return module.default();
        } catch (err) {
          log && debug(`Attempt to use package '${name}' failed %O`, err);
        }
      }
    }
  }

  const defaultAdapter = "@marko/run/adapter";
  const module = await import(defaultAdapter);
  log && debug("Using default adapter");
  return module.default();
}

const markoEntryFileRegex = /__marko-run__([^.]+)(?:\.(.+))?\.marko\.([^.]+)$/;
function getEntryFileName(file: string | undefined | null) {
  const match = file && markoEntryFileRegex.exec(file);
  return match ? match[2] || "index" : undefined;
}

export function isPluginIncluded(config: ResolvedConfig) {
  return config.plugins.some((plugin) => {
    return plugin.name.startsWith(PLUGIN_NAME_PREFIX);
  });
}

function getImporters(
  module: ModuleNode,
  fileName: string,
  seen: Set<string> = new Set(),
) {
  for (const importer of module.importers) {
    if (importer.id && !seen.has(importer.id)) {
      seen.add(importer.id);
      getImporters(importer, fileName, seen);
    }
  }
  return seen;
}

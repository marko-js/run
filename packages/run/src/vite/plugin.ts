import path from "path";
import crypto from "crypto";
import fs from "fs";
import glob from "glob";

import { mergeConfig } from "vite";
import type { ViteDevServer, Plugin, ResolvedConfig, UserConfig } from "vite";
import type { PluginContext, OutputOptions } from "rollup";

import type * as Compiler from "@marko/compiler";
import markoVitePlugin, { FileStore } from "@marko/vite";
import type { BuildStore } from "@marko/vite";

import {
  buildRoutes,
  isRoutableFile,
  matchRoutableFile,
} from "./routes/builder";
import { createFSWalker } from "./routes/walk";
import type { Options, Adapter, BuiltRoutes, HttpVerb } from "./types";
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
  browserEntryQuery,
  RoutableFileTypes,
  markoRunFilePrefix,
  virtualRuntimePrefix,
} from "./constants";
import { getExportIdentifiers } from "./utils/ast";
import { logRoutesTable } from "./utils/log";

import {
  getExternalAdapterOptions,
  getExternalPluginOptions,
  setExternalPluginOptions,
} from "./utils/config";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const markoExt = ".marko";

const POSIX_SEP = "/";
const WINDOWS_SEP = "\\";

const normalizePath =
  path.sep === WINDOWS_SEP
    ? (id: string) => id.replace(/\\/g, POSIX_SEP)
    : (id: string) => id;

function isMarkoFile(id: string) {
  return id.endsWith(markoExt);
}

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
  let { routesDir = "src/routes", adapter, ...markoOptions } = opts;

  let compiler: typeof Compiler;
  let store: BuildStore;
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
  let routeDataFilename = "routes.json";
  let extractVerbs: (filePath: string) => Promise<HttpVerb[]>;
  let resolvedConfig: ResolvedConfig;
  let typesFile: string | undefined;

  let isStale = true;
  let isRendered = false;
  const virtualFiles = new Map<string, string>();

  let times: TimeMetrics = {
    routesBuild: 0,
    routesRender: 0,
  };

  async function writeTypesFile() {
    if (
      (tsConfigExists ??= await globFileExists(
        root,
        "{.tsconfig*,tsconfig*.json}"
      ))
    ) {
      const filepath = path.join(typesDir, "routes.d.ts");

      const data = await renderRouteTypeInfo(
        routes,
        path.relative(typesDir, resolvedRoutesDir),
        adapter
      );

      if (data !== typesFile || !fs.existsSync(filepath)) {
        await ensureDir(typesDir);
        await fs.promises.writeFile(filepath, (typesFile = data));
      }
    }
  }

  async function setVirtualFiles(render: boolean = false) {
    for (const route of routes.list) {
      if (render && route.handler) {
        route.handler.verbs = await extractVerbs(route.handler.filePath);
        if (!route.handler.verbs.length) {
          console.warn(
            `Did not find any valid exports in middleware entry file:'${route.handler.filePath}' - expected to find any of 'GET', 'POST', 'PUT' or 'DELETE'`
          );
        }
      }
      if (route.page) {
        virtualFiles.set(
          path.posix.join(
            root,
            `${markoRunFilePrefix}route__${route.key}.marko`
          ),
          render ? renderRouteTemplate(route) : ""
        );
      }
      virtualFiles.set(
        path.posix.join(root, `${markoRunFilePrefix}route__${route.key}.js`),
        render ? renderRouteEntry(route) : ""
      );
    }
    for (const route of Object.values(routes.special)) {
      virtualFiles.set(
        path.posix.join(
          root,
          `${markoRunFilePrefix}special__${route.key}.marko`
        ),
        render ? renderRouteTemplate(route) : ""
      );
    }
    virtualFiles.set(
      "@marko/run/router",
      render
        ? renderRouter(routes, {
            trailingSlashes: opts.trailingSlashes || "RedirectWithout",
          })
        : ""
    );

    virtualFiles.set(
      path.posix.join(root, `${markoRunFilePrefix}middleware.js`),
      render ? renderMiddleware(routes.middleware) : ""
    );
  }

  const buildVirtualFiles = single(async () => {
    const startTime = performance.now();
    routes = await buildRoutes(createFSWalker(resolvedRoutesDir), routesDir);
    times.routesBuild = performance.now() - startTime;

    await setVirtualFiles(false);

    isStale = false;
    isRendered = false;
  });

  const renderVirtualFiles = single(async () => {
    const startTime = performance.now();
    await setVirtualFiles(true);
    await writeTypesFile();
    times.routesRender = performance.now() - startTime;
    isRendered = true;
  });

  return [
    {
      name: "marko-run-vite:pre",
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
          (config.logLevel !== "silent" && !isBuild) || isSSRBuild
        );

        if (adapter) {
          const externalAdapterConfig = getExternalAdapterOptions(config);
          if (externalAdapterConfig && adapter.configure) {
            adapter.configure(externalAdapterConfig);
          }
          const adapterOptions = await adapter.pluginOptions?.(opts);
          if (adapterOptions) {
            opts = mergeConfig(opts, adapterOptions);
          }
        }

        compiler ??= await import(opts.compiler || "@marko/compiler");
        compiler.taglib.register("@marko/run", {
          "<*>": {
            transform: path.resolve(
              __dirname,
              "../components/src-attributes-transformer.cjs"
            ),
          },
        });

        store =
          opts.store ||
          new FileStore(
            `marko-serve-vite-${crypto
              .createHash("SHA1")
              .update(root)
              .digest("hex")}`
          );
        resolvedRoutesDir = path.resolve(root, routesDir);
        typesDir = path.join(root, ".marko-run");
        devEntryFile = path.join(root, "index.html");
        devEntryFilePosix = normalizePath(devEntryFile);

        const assetsDir = config.build?.assetsDir || "assets";
        let rollupOutputOptions = config.build?.rollupOptions?.output;

        if (isBuild && !isSSRBuild) {
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
            chunkFileNames: `${assetsDir}/_[hash].js`,
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

        let pluginConfig: UserConfig = {
          logLevel: isBuild ? "warn" : undefined,
          define: isBuild
            ? {
                "process.env.NODE_ENV": "'production'",
              }
            : undefined,
          ssr: {
            noExternal: /@marko\/run/,
          },
          build: {
            emptyOutDir: isSSRBuild, // Avoid server & client deleting files from each other.
            rollupOptions: {
              output: rollupOutputOptions,
            },
          },
        };

        const adapterConfig = await adapter?.viteConfig?.(config);
        if (adapterConfig) {
          pluginConfig = mergeConfig(pluginConfig, adapterConfig);
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
      },
      configureServer(_server) {
        devServer = _server;
        devServer.watcher.on("all", async (type, filename) => {
          const file = path.parse(filename);
          if (
            filename.startsWith(resolvedRoutesDir) &&
            isRoutableFile(file.base)
          ) {
            if (type === "add") {
              isStale = true;
            } else if (type === "unlink") {
              isStale = true;
            } else if (type === "change") {
              const match = matchRoutableFile(file.base);
              if (match === RoutableFileTypes.Handler) {
                isStale = true;
              }
            }
            if (isStale) {
              // TODO: figure out how to make this better
              for (const id of virtualFiles.keys()) {
                devServer.watcher.emit("change", id);
                break;
              }
            }
          }
        });
      },
      async buildStart(_options) {
        if (isBuild && !isSSRBuild) {
          // Routes and code should have been generated in the SSR build that ran previously
          try {
            routeData = JSON.parse(
              (await store.get(routeDataFilename))!
            ) as RouteData;
          } catch {
            this.error(
              `You must run the "ssr" build before the "browser" build.`
            );
          }

          routes = routeData.routes;
          times = routeData.times;
          for (const { key, code } of routeData.files) {
            virtualFiles.set(key, code);
          }
          isStale = false;
          isRendered = true;
        } else {
          // Build routes and generate code
          extractVerbs = isBuild
            ? getVerbsFromFileBuild.bind(null, this)
            : getVerbsFromFileDev.bind(null, devServer);
        }
      },
      async resolveId(importee, importer, { ssr }) {
        let resolved: string | undefined;
        if (importee.startsWith(virtualRuntimePrefix)) {
          return this.resolve(
            path.resolve(__dirname, "../runtime/internal"),
            importer,
            { skipSelf: true }
          );
        } else if (importee.startsWith(virtualFilePrefix)) {
          importee = path.resolve(
            root,
            importee.slice(virtualFilePrefix.length + 1)
          );
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

        if (isStale) {
          await buildVirtualFiles();
        }
        if (virtualFiles.has(importee)) {
          resolved = importee;
          if (isBuild && !ssr && isMarkoFile(resolved)) {
            resolved += browserEntryQuery;
          }
        }

        return resolved || null;
      },
      async load(id) {
        if (virtualFiles.has(id)) {
          if (!isRendered) {
            await renderVirtualFiles();
            if (!isBuild) {
              await opts?.emitRoutes?.(routes.list);
            }
          }
          return virtualFiles.get(id);
        }
      },
    },
    ...(markoVitePlugin({
      ...markoOptions,
      get store() {
        return store;
      },
    }) as any),
    {
      name: "marko-run-vite:post",
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
            []
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

          await store.set(routeDataFilename, JSON.stringify(routeData));

          await opts?.emitRoutes?.(routes.list);
        } else if (isBuild) {
          logRoutesTable(routes, bundle);
        }
      },
      async closeBundle() {
        if (isBuild && !isSSRBuild && adapter?.buildEnd) {
          await adapter.buildEnd(
            resolvedConfig,
            routes.list,
            routeData.builtEntries,
            routeData.sourceEntries
          );
        }
      },
    },
  ];
}

async function getVerbsFromFileBuild(context: PluginContext, filePath: string) {
  const verbs: HttpVerb[] = [];
  const result = await context.load({
    id: filePath,
    resolveDependencies: false,
  });
  if (result) {
    const exportIds = getExportIdentifiers(result.ast);
    for (const id of exportIds) {
      const verb = id.toLowerCase() as HttpVerb;
      if (id === verb.toUpperCase() && httpVerbs.includes(verb)) {
        verbs.push(verb);
      }
    }
  }
  return verbs;
}

async function getVerbsFromFileDev(devServer: ViteDevServer, filePath: string) {
  const verbs: HttpVerb[] = [];
  const result = await devServer.transformRequest(filePath, { ssr: true });
  if (result && result.code) {
    const verbMatchReg =
      /__vite_ssr_exports__,\s+["'](GET|POST|PUT|DELETE)["']/gi;
    let match = verbMatchReg.exec(result.code);
    while (match) {
      const id = match[1];
      const verb = id.toLowerCase() as HttpVerb;
      if (httpVerbs.includes(verb)) {
        if (id === verb.toUpperCase()) {
          verbs.push(verb);
        } else {
          console.warn(
            `Found export '${id}' in handler ${filePath} which is close to '${verb.toUpperCase()}'. Exported handlers need to be uppercase: GET, POST, PUT or DELETE.`
          );
        }
      }
      match = verbMatchReg.exec(result.code);
    }
  }
  return verbs;
}

function single<P extends any[], R>(
  fn: (...args: P) => Promise<R>
): (...args: P) => Promise<R> {
  let promise: Promise<R> | undefined;
  return async (...args: P) => {
    if (promise) {
      return promise;
    }
    promise = fn(...args);
    const result = await promise;
    promise = undefined;
    return result;
  };
}

async function globFileExists(root: string, pattern: string) {
  return new Promise<boolean>((resolve, reject) => {
    glob(pattern, { root }, (err, matches) => {
      if (err) {
        reject(err);
      }
      resolve(matches.length > 0);
    });
  });
}

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

export async function resolveAdapter(
  root: string,
  options: Options,
  log?: boolean
): Promise<Adapter | null> {
  const { adapter } = options;
  if (adapter !== undefined) {
    return adapter;
  }
  const { resolvePackageData } = await import("vite");
  const pkg = resolvePackageData(".", root);
  if (pkg) {
    const dependecies = {
      ...pkg.data.dependecies,
      ...pkg.data.devDependencies,
    };
    for (const name of Object.keys(dependecies)) {
      if (
        name.startsWith("@marko/run-adapter") ||
        name.indexOf("marko-run-adapter") !== -1
      ) {
        try {
          const module = await import(name);
          log &&
            console.log(
              `Using adapter ${name} listed in your package.json dependecies`
            );
          return module.default();
        } catch (err) {
          log && console.warn(`Attempt to use package '${name}' failed`, err);
        }
      }
    }
  }

  const defaultAdapter = "@marko/run/adapter";
  const module = await import(defaultAdapter);
  log && console.log("Using default adapter");
  return module.default();
}

const markoEntryFileRegex = /__marko-run__([^_]+)__(.+)\.marko.([^.]+)$/;
function getEntryFileName(file: string | undefined | null) {
  const match = file && markoEntryFileRegex.exec(file);
  return match ? `${match[2].replace(/__/g, "-")}` : undefined;
}

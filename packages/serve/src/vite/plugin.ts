import path from "path";
import crypto from "crypto";
import fs from "fs/promises";

import { mergeConfig, normalizePath, ResolvedConfig, UserConfig } from "vite";
import type { ViteDevServer, Plugin } from "vite";
import type { PluginContext } from "rollup";

import markoVitePlugin, { FileStore } from "@marko/vite";
import type { BuildStore } from "@marko/vite";

import {
  buildRoutes,
  isRoutableFile,
  matchRoutableFile,
} from "./routes/builder";
import { createFSWalker } from "./routes/walk";
import type { Options, BuiltRoutes, HttpVerb, BuildInfo } from "./types";
import { renderRouteEntry, renderRouter, renderRouteTemplate } from "./codegen";
import {
  virtualFilePrefix,
  httpVerbs,
  browserEntryQuery,
  RoutableFileTypes,
} from "./constants";
import { getExportIdentifiers } from "./utils/ast";
import { logRoutesTable } from "./utils/log";

import { getMarkoServeOptions, setMarkoServeOptions } from "./utils/config";

const buildInfoFilename = ".markobuildinfo";
const markoExt = ".marko";
const markoServeFilePrefix = "__marko-serve__";

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

export default function markoServe(opts: Options = {}): Plugin[] {
  const { routesDir = "src/routes", adapter, ...markoOptions } = opts;

  let store: BuildStore;
  let root: string;
  let resolvedRoutesDir: string;
  let isBuild = false;
  let isSSRBuild = false;
  let ssrEntryFiles: string[];
  let devEntryFile: string;
  let devServer: ViteDevServer;
  let routes: BuiltRoutes;
  let routeData!: RouteData;
  let routeDataFilename = "routes.json";
  let extractVerbs: (filePath: string) => Promise<HttpVerb[]>;
  let resolvedConfig: ResolvedConfig;

  let isStale = true;
  let isRendered = false;
  const virtualFiles = new Map<string, string>();

  let times: TimeMetrics = {
    routesBuild: 0,
    routesRender: 0,
  };

  async function setVirtualFiles(render: boolean = false) {
    for (const route of routes.list) {
      if (render && route.handler) {
        route.handler.verbs = await extractVerbs(route.handler.filePath);
        if (!route.handler.verbs.length) {
          console.warn(
            `Did not find any valid exports in middleware entry file:'${route.handler.filePath}' - expected to find any of 'get', 'post', 'put' or 'del'`
          );
        }
      }
      if (route.page) {
        virtualFiles.set(
          path.join(root, `${markoServeFilePrefix}route__${route.key}.marko`),
          render ? renderRouteTemplate(route) : ""
        );
      }
      virtualFiles.set(
        path.join(root, `${markoServeFilePrefix}route__${route.key}.js`),
        render ? renderRouteEntry(route) : ""
      );
    }
    for (const route of Object.values(routes.special)) {
      virtualFiles.set(
        path.join(root, `${markoServeFilePrefix}special__${route.key}.marko`),
        render ? renderRouteTemplate(route) : ""
      );
    }
    virtualFiles.set(
      "@marko/serve/router",
      render ? renderRouter(routes, opts.codegen) : ""
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
    times.routesRender = performance.now() - startTime;
    isRendered = true;
  });

  return [
    {
      name: "marko-serve-vite:pre",
      enforce: "pre",
      async config(config, env) {
        const externalPluginOptions = getMarkoServeOptions(config);
        if (externalPluginOptions) {
          opts = mergeConfig(opts, externalPluginOptions);
        }
        const adapterOptions = await adapter?.pluginOptions?.(opts);
        if (adapterOptions) {
          opts = mergeConfig(opts, adapterOptions);
        }

        root = normalizePath(config.root || process.cwd());
        store =
          opts.store ||
          new FileStore(
            `marko-serve-vite-${crypto
              .createHash("SHA1")
              .update(root)
              .digest("hex")}`
          );
        isBuild = env.command === "build";
        isSSRBuild = isBuild && Boolean(config.build?.ssr);
        resolvedRoutesDir = path.resolve(root, routesDir);
        devEntryFile = path.join(root, "index.html");

        let pluginConfig: UserConfig = {
          logLevel: isBuild ? "warn" : undefined,
          define: isBuild
            ? {
                "process.env.NODE_ENV": "'production'",
              }
            : undefined,
          build: {
            emptyOutDir: isSSRBuild, // Avoid server & client deleting files from each other.
          },
        };

        const adapterConfig = await adapter?.viteConfig?.(config);
        if (adapterConfig) {
          pluginConfig = mergeConfig(pluginConfig, adapterConfig);
        }

        return setMarkoServeOptions(pluginConfig, opts);
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
        if (importee.startsWith(virtualFilePrefix)) {
          importee = path.resolve(
            root,
            importee.slice(virtualFilePrefix.length + 1)
          );
        } else if (
          !isBuild &&
          importer === devEntryFile &&
          importee.startsWith(`/${markoServeFilePrefix}`)
        ) {
          importee = path.resolve(root, "." + importee);
        }

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
      name: "marko-serve-vite:post",
      enforce: "post",
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

          const buildInfo: BuildInfo = {
            entryFile: path.relative(options.dir!, builtEntries[0]),
          };

          await fs.writeFile(
            path.join(options.dir!, buildInfoFilename),
            JSON.stringify(buildInfo),
            "utf-8"
          );

          await opts?.emitRoutes?.(routes.list);
        } else if (isBuild) {
          console.log(
            `\n\nRoutes built in ${(
              times.routesBuild + times.routesRender
            ).toFixed(2)}ms\n`
          );
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

export async function loadBuildInfo(dir: string): Promise<BuildInfo> {
  const filepath = path.join(dir, buildInfoFilename);
  return JSON.parse(await fs.readFile(filepath, "utf-8")) as BuildInfo;
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
      const verb = id === "del" ? "delete" : (id as HttpVerb);
      if (httpVerbs.includes(verb)) {
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
    const verbMatchReg = /__vite_ssr_exports__,\s+["'](get|post|put|del)["']/g;
    let match = verbMatchReg.exec(result.code);
    while (match) {
      const verb = match[1] === "del" ? "delete" : (match[1] as HttpVerb);
      if (httpVerbs.includes(verb)) {
        verbs.push(verb);
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

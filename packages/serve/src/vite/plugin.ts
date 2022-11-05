import os from "os";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

import { normalizePath } from "vite";
import type * as vite from "vite";
import type { PluginContext } from "rollup";

import markoVitePlugin from "@marko/vite";
import type * as markoVite from "@marko/vite";

import {
  buildRoutes,
  isRoutableFile,
  matchRoutableFile,
} from "./routes/builder";
import { createFSWalker } from "./routes/walk";
import type { BuiltRoutes, HttpVerb, Route } from "./types";
import {
  renderRouteEntry,
  renderRouter,
  renderRouteTemplate,
} from "./codegen";
import { virtualFilePrefix, httpVerbs, browserEntryQuery, RoutableFileTypes } from "./constants";
import { getExportIdentifiers } from "./utils/ast";
import { logRoutesTable } from "./utils/log";

interface MarkoServeOptions {
  routesDir?: string;
  emitRoutes?(routes: Route[]): void | Promise<void>;
}

export type Options = MarkoServeOptions & markoVite.Options;

const markoExt = ".marko";
const markoServeFilePrefix = "__marko-serve__";

function isMarkoFile(id: string) {
  return id.endsWith(markoExt);
}

interface TimeMetrics {
  routesBuild: number,
  routesRender: number
}

interface RouteData {
  routes: BuiltRoutes;
  files: { key: string; code: string }[];
  times: TimeMetrics;
}

export default function markoServe(opts: Options = {}): vite.Plugin[] {
  const { routesDir = "src/routes", ...markoOptions } = opts;

  let root: string;
  let resolvedRoutesDir: string;
  let isBuild = false;
  let isSSRBuild = false;
  let devEntryFile: string;
  let devServer: vite.ViteDevServer;
  let routes: BuiltRoutes;
  let tempDir: string;
  let routeDataFilename: string;
  let extractVerbs: (filePath: string) => Promise<HttpVerb[]>;

  let isStale = true;
  let isRendered = false;
  const virtualFiles = new Map<string, string>();

  let times: TimeMetrics = {
    routesBuild: 0,
    routesRender: 0
  }

  async function setVirtualFiles(render: boolean = false) {
    for (const route of routes.list) {
      if (render && route.handler) {
        route.handler.verbs = await extractVerbs(
          route.handler.filePath
        );
        if (!route.handler.verbs.length) {
          console.warn(
            `Did not find any valid exports in middleware entry file:'${route.handler.filePath}' - expected to find any of 'get', 'post', 'put' or 'del'`
          );
        }
      }
      if (route.page) {
        virtualFiles.set(
          path.join(root, `${markoServeFilePrefix}route__${route.key}.marko`),
          render ? renderRouteTemplate(route) : ''
        );
      }
      virtualFiles.set(
        path.join(root, `${markoServeFilePrefix}route__${route.key}.js`),
        render ? renderRouteEntry(route) : ''
      );
    }
    for (const route of Object.values(routes.special)) {
      virtualFiles.set(
        path.join(root, `${markoServeFilePrefix}special__${route.key}.marko`),
        render ? renderRouteTemplate(route) : ''
      );
    }
    virtualFiles.set(
      '@marko/serve/router',
      render ? renderRouter(routes) : ''
    );
  }

  const buildVirtualFiles = single(async () => {
    const startTime = performance.now();
    routes = await buildRoutes(
      createFSWalker(resolvedRoutesDir),
      routesDir
    );
    times.routesBuild = performance.now() - startTime;

    await setVirtualFiles(false);

    isStale = false;
    isRendered = false;
  })

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
        root = normalizePath(config.root || process.cwd());
        tempDir = await getTempDir(root);
        routeDataFilename = path.join(tempDir, "routes.json");
        isBuild = env.command === "build";
        isSSRBuild = isBuild && Boolean(config.build!.ssr);
        resolvedRoutesDir = path.resolve(root, routesDir);
        devEntryFile = path.join(root, "index.html");

        // console.log({
        //   root,
        //   tempDir,
        //   routeDataFilename,
        //   isBuild,
        //   isSSRBuild,
        //   resolvedRoutesDir,
        //   devEntryFile
        // })

        if (isBuild) {
          return {
            logLevel: 'warn',
            define: {
              __MARKO_SERVE_PROD__: "true"
            }
          }
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
          let routeData!: RouteData;
          try {
            routeData = JSON.parse(
              await fs.readFile(routeDataFilename, "utf-8")
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
          extractVerbs = isBuild ? getVerbsFromFileBuild.bind(null, this) : getVerbsFromFileDev.bind(null, devServer);
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
      async buildEnd() {
        if (isSSRBuild) {
          const routeData: RouteData = {
            routes,
            files: [],
            times
          };
          for (const [key, code] of virtualFiles) {
            routeData.files.push({ key, code });
          }

          await fs.writeFile(routeDataFilename, JSON.stringify(routeData));

          await opts?.emitRoutes?.(routes.list);
        }
      }
    },
    ...markoVitePlugin(markoOptions),
    {
      name: "marko-serve-vite:post",
      enforce: "post",
      generateBundle(_oiptions, bundle) {
        if (isBuild && !isSSRBuild) {
          console.log(`\n\nRoutes built in ${(times.routesBuild + times.routesRender).toFixed(2)}ms\n`);
          logRoutesTable(routes, bundle);
          console.log('\nRun `npm run start` to serve the production build\n\n');
        }
      }
    }
  ];
}

async function getTempDir(root: string) {
  const dir = path.join(
    os.tmpdir(),
    `marko-serve-vite-${crypto.createHash("SHA1").update(root).digest("hex")}`
  );

  try {
    const stat = await fs.stat(dir);

    if (stat.isDirectory()) {
      return dir;
    }
  } catch {
    await fs.mkdir(dir);
    return dir;
  }

  throw new Error("Unable to create temp directory");
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

async function getVerbsFromFileDev(
  devServer: vite.ViteDevServer,
  filePath: string
) {
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


function single<P extends any[], R>(fn: (...args: P) => Promise<R>): (...args: P) => Promise<R> {
  let promise: Promise<R> | undefined;
  return async (...args: P) => {
    if (promise) {
      return promise;
    }
    promise = fn(...args);
    const result = await promise;
    promise = undefined;
    return result;
  }
}

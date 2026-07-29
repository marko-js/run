import markoVitePlugin from "@marko/vite";
import browserslist from "browserslist";
import createDebug from "debug";
import { resolveToEsbuildTarget } from "esbuild-plugin-browserslist";
import fs from "fs";
import { glob } from "glob";
import path from "path";
import {
  type OutputOptions,
  type PluginContext,
  RolldownMagicString,
} from "rolldown";
import { fileURLToPath } from "url";
import {
  buildErrorMessage,
  mergeConfig,
  type ModuleNode,
  type Plugin,
  type ResolvedConfig,
  transformWithOxc,
  type ViteDevServer,
} from "vite";

import { prepareError } from "../adapter/utils";
import {
  renderMiddleware,
  renderRouteEntry,
  renderRouter,
  renderRoutesClient,
  renderRouteTemplate,
  renderRouteTypeInfo,
  ROUTES_CLIENT_FILENAME,
} from "./codegen";
import {
  httpVerbs,
  markoRunFilePrefix,
  RoutableFileTypes,
  virtualFilePrefix,
} from "./constants";
import {
  ARTIFACT_VIRTUAL_PREFIX,
  type ArtifactEmission,
  emitPartitionArtifacts,
} from "./persisted-plan/artifact-emission";
import { getArtifactEmissionForTest } from "./persisted-plan/artifact-emission-test-hook";
import {
  computeConfigEpoch,
  configEpochSliceFromVite,
} from "./persisted-plan/config-epoch";
import {
  createPersistedPlanHost,
  normalizedEntrySpelling,
  type PersistedPlanHost,
} from "./persisted-plan/coordinator";
import { createMarkoViteHost } from "./persisted-plan/vite-resolver";
import { buildRoutes, matchRoutableFile } from "./routes/builder";
import { createFSWalker } from "./routes/walk";
import type {
  Adapter,
  BuiltRoutes,
  ExternalRoutes,
  HttpVerb,
  Options,
  PackageData,
  Route,
} from "./types";
import appendAgentFixGuide from "./utils/agent-fix-guide";
import { getExportIdentifiers } from "./utils/ast";
import {
  getExternalAdapterOptions,
  getExternalPluginOptions,
  setExternalPluginOptions,
} from "./utils/config";
import { normalizePath } from "./utils/fs";
import { findHrefReplacements } from "./utils/href-replace";
import { logRoutesTable } from "./utils/log";
import { ReadOncePersistedStore } from "./utils/read-once-persisted-store";
import { getRouteVirtualFileName } from "./utils/route";
import {
  collectShellManifest,
  findStaticShellIds,
  recordStaticShellIds,
} from "./utils/static-shells";

const debug = createDebug("@marko/run");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLUGIN_NAME_PREFIX = "marko-run-vite";
const CLIENT_OUT_DIR = "public";
const MIDDLEWARE_FILENAME = `${markoRunFilePrefix}middleware.js`;
const ROUTER_FILENAME = `${markoRunFilePrefix}router.js`;

export const defaultPort = Number(process.env.PORT || 3000);

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

declare module "vite" {
  interface TransformResult {
    exports?: string[];
  }
}

export default function markoRun(opts: Options = {}): Plugin[] {
  let routesDir: NonNullable<(typeof opts)["routesDir"]>;
  let adapter: NonNullable<(typeof opts)["adapter"]> | null;
  let trailingSlashes: NonNullable<(typeof opts)["trailingSlashes"]>;
  let persisted: boolean;
  // Artifact emission is always on when persisted is on. Dual-entry remains
  // only as fail-closed when seal is incomplete — not a user-facing mode.
  // Measurement dual A/B uses setArtifactEmissionForTest (globalThis hook),
  // never a config property.
  let artifactEmissionActive = true;
  let persistedPlanHost: PersistedPlanHost | undefined;
  // Host fields for @marko/vite (typed here so run builds without waiting on
  // a published vite types bump). Single persistedBuild object is the peer
  // contract — not app Options.
  const markoVitePluginOptions = { ...opts } as typeof opts & {
    persisted?: boolean;
    runtimeId?: string;
    basePathVar?: string;
    isEntry?: (importee: string, importer: string) => boolean;
    persistedBuild?: {
      planHost: unknown;
      planEntries?: string[];
      cutoverClientGraph: boolean;
    };
  };

  let store: ReadOncePersistedStore<RouteData>;
  let root: string;
  let shouldEmptyOutDir = false;
  let outputDir: string;
  let resolvedRoutesDir: string;
  let entryFilesDir: string;
  let entryFilesDirPosix: string;
  let relativeEntryFilesDirPosix: string;
  let typesDir: string;
  let isBuild = false;
  let isSSRBuild = false;
  let tsConfigExists: boolean | undefined;
  let ssrEntryFiles: string[];
  let devEntryFile: string;
  let devEntryFilePosix: string;
  let devServer: ViteDevServer;
  let routes: BuiltRoutes;
  let entryTemplates: Set<string>;
  let entryTemplateImporters: Set<string>;
  let routeData!: RouteData;
  let resolvedConfig: ResolvedConfig;
  let typesFile: string | undefined;
  let runtimeInclude: string | undefined;
  // Browser-build collection for the persisted shell manifest: the ids each
  // `?persisted` module registers, then per-route unions over static chunk
  // closures (appended to the built server entries in writeBundle).
  const staticShellIds = new Map<string, string[]>();
  let shellManifest: Record<string, string[]> | undefined;

  const externalRoutes = new Set<ExternalRoutes>();
  const seenErrors = new Set<string>();
  const virtualFiles = new Map<string, string>();
  const artifactVirtualFiles = new Map<string, string>();
  const artifactAliases = new Map<string, string>();
  const ordinaryCanonicalByVirtual = new Map<string, string>();
  /** C3: marko source path → merge virtual for print-skip dual-entry stubs. */
  const cutoverMergeBySource = new Map<string, string>();
  let artifactEmission: ArtifactEmission | undefined;
  let artifactPublicationToken: string | undefined;

  let times: TimeMetrics = {
    routesBuild: 0,
    routesRender: 0,
  };

  async function loadModule(context: PluginContext, id: string) {
    if ("transformRequest" in context.environment) {
      await context.environment.transformRequest(id);
      return context.getModuleInfo(id);
    }
    return await context.load({ id });
  }

  async function getExportsFromFile(context: PluginContext, filePath: string) {
    if (devServer) {
      if (/\.[cm]?[jt]sx?$/i.test(filePath)) {
        // Parsed in isolation: these are server-only files, and transforming
        // them through a dev environment pulls in their whole import graph.
        const source = await fs.promises.readFile(filePath, "utf-8");
        const { code } = await transformWithOxc(source, filePath);
        return getExportIdentifiers(context.parse(code));
      }
      // Anything else (e.g. `.marko`) must compile before it parses as JS.
      const result = await devServer.transformRequest(filePath, { ssr: false });
      return result ? getExportIdentifiers(context.parse(result.code)) : [];
    }
    const result = await context.load({
      id: filePath,
      resolveDependencies: false,
    });
    return result.exports || [];
  }

  // Persisted pages only exist for the tags API; refusing the combination
  // here keeps every downstream persisted path free of class-API awareness.
  function assertPersistedMarkoApi(markoApi: string | undefined, route: Route) {
    if (persisted && markoApi === "class") {
      throw new Error(
        `The \`persisted\` option does not support class API routes (${path.relative(root, route.layouts[0]!.filePath)})`,
      );
    }
    return markoApi;
  }

  let routeMarkoApiCache: Map<Route, string | undefined> | undefined;
  async function getMarkoApiForRoute(context: PluginContext, route: Route) {
    routeMarkoApiCache ??= new Map();
    if (!routeMarkoApiCache.has(route)) {
      const markoAPI = route.layouts.length
        ? ((await loadModule(context, normalizePath(route.layouts[0].filePath)))
            ?.meta?.markoAPI as string | undefined)
        : undefined;
      routeMarkoApiCache.set(route, markoAPI);
      return markoAPI;
    }
    return routeMarkoApiCache.get(route);
  }

  async function writeTypesFile(routes: BuiltRoutes) {
    if (
      routes &&
      (tsConfigExists ??= await globFileExists(
        root,
        "{.tsconfig*,tsconfig*.json}",
      ))
    ) {
      const filepath = path.join(typesDir, "routes.d.ts");

      const data = await renderRouteTypeInfo(routes, typesDir, adapter);

      if (data !== typesFile || !fs.existsSync(filepath)) {
        await ensureDir(typesDir);
        await fs.promises.writeFile(filepath, (typesFile = data));
      }
    }
  }

  let buildVirtualFilesResult: Promise<BuiltRoutes> | undefined;
  function buildVirtualFiles() {
    return (buildVirtualFilesResult ??= (async () => {
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
      if (fs.existsSync(resolvedRoutesDir)) {
        routes = await buildRoutes(
          {
            walker: createFSWalker(resolvedRoutesDir),
          },
          entryFilesDir,
        );

        if (
          !isBuild &&
          !routes.list.length &&
          !Object.keys(routes.special).length
        ) {
          console.warn(`No routes found in ${resolvedRoutesDir}`);
        }
      } else {
        routes = {
          list: [],
          special: {},
          middleware: [],
        };

        if (!isBuild) {
          console.warn(`Routes directory ${resolvedRoutesDir} does not exist`);
        }
      }

      entryTemplates = new Set();
      entryTemplateImporters = new Set();

      for (const route of routes.list) {
        if (route.templateFilePath) {
          entryTemplates.add(normalizePath(route.templateFilePath));
        }
        for (const middleware of route.middleware) {
          entryTemplateImporters.add(normalizePath(middleware.filePath));
        }
        if (route.handler) {
          entryTemplateImporters.add(normalizePath(route.handler.filePath));
        }

        virtualFiles.set(
          path.posix.join(root, getRouteVirtualFileName(route)),
          "",
        );
      }
      for (const route of Object.values(routes.special) as Route[]) {
        if (route.templateFilePath) {
          entryTemplates.add(normalizePath(route.templateFilePath));
        }
      }

      if (routes.middleware.length) {
        virtualFiles.set(path.posix.join(root, MIDDLEWARE_FILENAME), "");
      }
      virtualFiles.set(path.posix.join(root, ROUTER_FILENAME), "");
      if (persisted) {
        virtualFiles.set(path.posix.join(root, ROUTES_CLIENT_FILENAME), "");
      }

      for (const externalRoute of externalRoutes) {
        for (const { entryFile } of externalRoute.routes) {
          if (/\.marko(\?.*)?$/i.test(entryFile)) {
            entryTemplates.add(normalizePath(entryFile));
          } else {
            entryTemplateImporters.add(normalizePath(entryFile));
          }
        }
      }

      if (persisted && persistedPlanHost) {
        // Route structure is the partition's second input. A same-signature
        // W3 rebuild stays warm; add/remove/template movement unpublishes
        // before the next dev or build seal.
        persistedPlanHost.notePartitionRoutes(partitionSealRoutes(routes));
      }

      return routes;
    })().catch((err) => {
      // Point coding agents at the cheat sheet on route-build errors,
      // whichever plugin hook triggered the build.
      throw appendAgentFixGuide(err);
    }));
  }

  let renderVirtualFilesResult: Promise<void> | undefined;
  function renderVirtualFiles(context: PluginContext) {
    return (renderVirtualFilesResult ??= (async () => {
      try {
        const routes = await buildVirtualFiles();
        if (fs.existsSync(entryFilesDir)) {
          fs.rmSync(entryFilesDir, { recursive: true });
        }

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
              const nearMisses = exports.filter(
                (name) =>
                  name !== name.toUpperCase() &&
                  httpVerbs.includes(name.toLowerCase() as HttpVerb),
              );
              context.warn(
                `Did not find any http verb exports in ${path.relative(root, route.handler.filePath)} - expected ${httpVerbs.map((v) => v.toUpperCase()).join(", ")}${
                  nearMisses.length
                    ? `. Found \`${nearMisses.join("`, `")}\` - verb exports must be uppercase, e.g. \`export const ${nearMisses[0].toUpperCase()} = Run.${nearMisses[0].toUpperCase()}(handler)\``
                    : ""
                }`,
              );
            }
          }

          if (route.templateFilePath) {
            fs.mkdirSync(path.dirname(route.templateFilePath), {
              recursive: true,
            });
            fs.writeFileSync(
              route.templateFilePath,
              renderRouteTemplate(
                route,
                assertPersistedMarkoApi(
                  await getMarkoApiForRoute(context, route),
                  route,
                ),
                !isBuild,
                persisted,
              ),
            );
          }

          virtualFiles.set(
            path.posix.join(root, getRouteVirtualFileName(route)),
            renderRouteEntry(route, root),
          );
        }
        for (const route of Object.values(routes.special) as Route[]) {
          fs.mkdirSync(path.dirname(route.templateFilePath!), {
            recursive: true,
          });
          fs.writeFileSync(
            route.templateFilePath!,
            renderRouteTemplate(
              route,
              assertPersistedMarkoApi(
                await getMarkoApiForRoute(context, route),
                route,
              ),
              !isBuild,
            ),
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
            path.posix.join(root, MIDDLEWARE_FILENAME),
            renderMiddleware(routes.middleware, root),
          );
        }

        runtimeInclude = await adapter?.runtimeInclude?.();

        virtualFiles.set(
          path.posix.join(root, ROUTER_FILENAME),
          renderRouter(routes, root, runtimeInclude, {
            trailingSlashes,
            persisted,
          }),
        );

        if (persisted) {
          virtualFiles.set(
            path.posix.join(root, ROUTES_CLIENT_FILENAME),
            renderRoutesClient(routes, root),
          );
        }

        await writeTypesFile(routes);
        if (adapter?.routesGenerated) {
          await adapter.routesGenerated({
            routes,
            virtualFiles: new Map(virtualFiles.entries()),
            meta: {
              buildTime: times.routesBuild,
              renderTime: times.routesRender,
            },
          });
          if (!isBuild) {
            await opts?.emitRoutes?.(routes.list);
          }
        }
      } catch (err) {
        // Tag codegen errors too (route-build errors arrive already tagged);
        // `prepareError` reads `message`, so the dev overlay carries it as well.
        appendAgentFixGuide(err);
        if (isBuild) {
          throw err;
        }
        virtualFiles.set(
          path.posix.join(root, ROUTER_FILENAME),
          `throw ${JSON.stringify(prepareError(err as Error))}`,
        );
      }
    })());
  }

  function clearArtifactEmission() {
    artifactEmission = undefined;
    artifactPublicationToken = undefined;
    artifactVirtualFiles.clear();
    artifactAliases.clear();
    ordinaryCanonicalByVirtual.clear();
    cutoverMergeBySource.clear();
    if (persisted && routes && root) {
      virtualFiles.set(
        path.posix.join(root, ROUTES_CLIENT_FILENAME),
        renderRoutesClient(routes, root),
      );
    }
  }

  function publishArtifactEmission(
    host: PersistedPlanHost,
    currentRoutes: BuiltRoutes,
    mode: "build" | "dev",
  ) {
    const sealed = sealPersistedPartition(host, currentRoutes, mode).state;
    if (!sealed) {
      clearArtifactEmission();
      return;
    }
    const plans = host.snapshotCommitted("client").flatMap((set) => set.plans);
    const next = emitPartitionArtifacts(
      sealed,
      plans,
      host.snapshotVirtualSources("client"),
    );
    const nextVirtuals = new Map<string, string>();
    for (const artifact of next.artifacts) {
      nextVirtuals.set(artifact.virtualId, artifact.source);
    }
    for (const facade of next.facades) {
      nextVirtuals.set(facade.virtualId, facade.source);
    }
    for (const passthrough of next.passthroughs) {
      if (passthrough.source !== undefined) {
        nextVirtuals.set(passthrough.virtualId, passthrough.source);
      }
    }

    // Atomic publication: no consumer observes a partial new generation.
    artifactVirtualFiles.clear();
    artifactAliases.clear();
    ordinaryCanonicalByVirtual.clear();
    cutoverMergeBySource.clear();
    for (const [id, source] of nextVirtuals) {
      artifactVirtualFiles.set(id, source);
    }
    for (const alias of next.aliases) {
      artifactAliases.set(alias.virtualId, alias.targetVirtualId);
    }
    for (const passthrough of next.passthroughs) {
      ordinaryCanonicalByVirtual.set(
        passthrough.virtualId,
        passthrough.canonical,
      );
    }
    for (const [moduleKey, virtualId] of Object.entries(
      next.mergeVirtualByModuleKey,
    )) {
      // One canonical key (normalizedEntrySpelling) plus the raw key so
      // absolute/posix callers still hit without inventing spellings.
      const canon = normalizedEntrySpelling(moduleKey);
      cutoverMergeBySource.set(canon, virtualId);
      cutoverMergeBySource.set(normalizePath(canon), virtualId);
      cutoverMergeBySource.set(moduleKey, virtualId);
      cutoverMergeBySource.set(normalizePath(moduleKey), virtualId);
    }
    artifactEmission = next;
    artifactPublicationToken = JSON.stringify(sealed.publicationToken);
    virtualFiles.set(
      path.posix.join(root, ROUTES_CLIENT_FILENAME),
      renderRoutesClient(currentRoutes, root, {
        routes: next.routes,
        artifacts: next.registry,
        capability: next.capability,
      }),
    );

    // The partition projection replaces the scrape as production authority.
    // Unknown possession is omitted by the emitter (underclaim/fail closed).
    shellManifest = Object.fromEntries(
      next.routes.map((route) => [
        String(route.routeIndex),
        route.possessionShellIndexes.map(
          (index) => next.capability.shellIds[index],
        ),
      ]),
    );
  }

  return [
    defaultConfigPlugin,
    {
      name: `${PLUGIN_NAME_PREFIX}:pre`,
      enforce: "pre",
      api: {
        addExternalRoutes(routes: ExternalRoutes) {
          externalRoutes.add(routes);
          return () => {
            externalRoutes.delete(routes);
          };
        },
        getPersistedPlanStats() {
          return persistedPlanHost?.getGenerationStats();
        },
        getPersistedPartition() {
          return persistedPlanHost?.getPublishedPartition();
        },
      },
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
        trailingSlashes = opts.trailingSlashes || "RedirectWithout";
        persisted = Boolean(opts.persisted);
        // Product path: emission on whenever persisted is on. Measurement
        // harness may force dual via setArtifactEmissionForTest(false).
        const testOverride = getArtifactEmissionForTest();
        artifactEmissionActive =
          persisted && (testOverride === undefined ? true : testOverride);
        markoVitePluginOptions.persisted = persisted || undefined;
        if (persisted) {
          // The plan coordinator (C0): `@marko/vite` hands every persisted
          // entry's `metadata.marko.updatePlan` carrier (or its absence,
          // under suppression) to this narrow host as a side channel. The
          // cache is coordinator-private; served bytes never change.
          // cutoverClientGraph tracks emission: true ⇒ prod client dual-entry
          // bodies are plan-only + merge rewrites (vite also requires isBuild).
          // Dual A/B (test hook false) keeps printed dual-entry modules.
          persistedPlanHost = createPersistedPlanHost();
          markoVitePluginOptions.persistedBuild = {
            planHost: createMarkoViteHost(persistedPlanHost, {
              resolveCutoverMerge(sourceFile: string) {
                const canon = normalizedEntrySpelling(sourceFile);
                return (
                  cutoverMergeBySource.get(canon) ||
                  cutoverMergeBySource.get(normalizePath(canon)) ||
                  cutoverMergeBySource.get(sourceFile) ||
                  cutoverMergeBySource.get(normalizePath(sourceFile))
                );
              },
            }),
            cutoverClientGraph: artifactEmissionActive,
          };
        } else {
          delete markoVitePluginOptions.persistedBuild;
        }
        store = new ReadOncePersistedStore(
          `vite-marko-run${opts.runtimeId ? `-${opts.runtimeId}` : ""}`,
        );
        markoVitePluginOptions.runtimeId = opts.runtimeId;
        markoVitePluginOptions.basePathVar = opts.basePathVar;
        markoVitePluginOptions.isEntry = (importee, importer) => {
          return (
            entryTemplates.has(importee) ||
            entryTemplateImporters.has(importer) ||
            adapter?.isEntryTemplate?.({ template: importee, importer }) ||
            false
          );
        };

        resolvedRoutesDir = path.resolve(root, routesDir);
        outputDir = path.join(root, config.build?.outDir || "dist");
        entryFilesDir = path.join(outputDir, ".marko-run");
        entryFilesDirPosix = normalizePath(entryFilesDir);
        relativeEntryFilesDirPosix = normalizePath(
          path.relative(root, entryFilesDir),
        );

        typesDir = path.join(root, ".marko-run");
        devEntryFile = path.join(root, "index.html");
        devEntryFilePosix = normalizePath(devEntryFile);
        let outDir = config.build?.outDir || "dist";
        const assetsDir = config.build?.assetsDir || "assets";
        let rolldownOutputOptions = config.build?.rolldownOptions?.output;

        if (isBuild) {
          if (!isSSRBuild) {
            outDir = path.join(outDir, CLIENT_OUT_DIR);
          }

          rolldownOutputOptions = mergeOutputOptions(
            {
              assetFileNames(info) {
                const name = info.names?.[0] && cleanFileName(info.names[0]);
                return name
                  ? `${assetsDir}/${name}-[hash].[ext]`
                  : `${assetsDir}/_[hash].[ext]`;
              },
              entryFileNames(info) {
                const raw = getEntryFileName(info.name) || info.name;
                const name = raw && cleanFileName(raw);
                return name
                  ? `${assetsDir}/${name}-[hash].js`
                  : `${assetsDir}/_[hash].js`;
              },
              chunkFileNames: isSSRBuild
                ? `_[hash].js`
                : (info) =>
                    persisted &&
                    info.moduleIds.some((id) =>
                      id.includes(ARTIFACT_VIRTUAL_PREFIX),
                    )
                      ? `${assetsDir}/a_[hash].js`
                      : `${assetsDir}/_[hash].js`,
            },
            rolldownOutputOptions,
          );
        }

        shouldEmptyOutDir = config.build?.emptyOutDir ?? true;

        const pluginConfig = (await adapter?.viteConfig?.(config)) || {};

        pluginConfig.ssr ??= {};
        pluginConfig.ssr.noExternal ??= /@marko\/run($|\/)/;

        pluginConfig.css ??= {};
        pluginConfig.css.devSourcemap ??= true;

        pluginConfig.build ??= {};
        pluginConfig.build.outDir ??= outDir;
        pluginConfig.build.assetsDir ??= assetsDir;
        pluginConfig.build.copyPublicDir ??= !isSSRBuild;
        pluginConfig.build.ssrEmitAssets ??= false;
        pluginConfig.build.emptyOutDir ??= false;
        pluginConfig.build.rolldownOptions ??= {};
        if (rolldownOutputOptions) {
          pluginConfig.build.rolldownOptions.output = mergeOutputOptions(
            rolldownOutputOptions,
            pluginConfig.build.rolldownOptions.output,
          );
        }
        pluginConfig.build.sourcemap ??=
          config.build?.sourcemap ?? (isBuild && !isSSRBuild);

        pluginConfig.build.modulePreload ??= {};
        if (typeof pluginConfig.build.modulePreload !== "boolean") {
          pluginConfig.build.modulePreload.polyfill = false;
          const configuredResolve =
            pluginConfig.build.modulePreload.resolveDependencies ??
            (typeof config.build?.modulePreload === "object"
              ? config.build.modulePreload.resolveDependencies
              : undefined);
          pluginConfig.build.modulePreload.resolveDependencies = (
            filename,
            dependencies,
            context,
          ) => {
            const resolved = configuredResolve
              ? configuredResolve(filename, dependencies, context)
              : dependencies;
            return filename.startsWith(`${assetsDir}/a_`) ? [] : resolved;
          };
        }

        pluginConfig.optimizeDeps ??= {};
        if (!config.optimizeDeps?.entries) {
          pluginConfig.optimizeDeps.entries = [
            `${normalizePath(path.relative(root, routesDir))}/**/*+{page,layout}.marko`,
            "!**/__snapshots__/**",
            "!**/__tests__/**",
            "!**/coverage/**",
          ];
        }

        if (isBuild && !config.build?.target) {
          pluginConfig.build.target = getBrowserslistTargets(root);
        }

        if (isBuild) {
          pluginConfig.logLevel ??= "warn";

          pluginConfig.define ??= {};
          pluginConfig.define["process.env.NODE_ENV"] ??= "'production'";

          pluginConfig.resolve ??= {};
          pluginConfig.resolve.mainFields ??= (
            isSSRBuild ? [] : ["browser"]
          ).concat(["module", "jsnext:main", "jsnext", "main"]);

          pluginConfig.resolve.conditions ??= [
            isSSRBuild ? "node" : "browser",
            "import",
            "require",
            "production",
            "default",
          ];
        }

        return setExternalPluginOptions(pluginConfig, opts);
      },
      configEnvironment() {
        // `@marko/run/router` resolves to a virtual module, so no
        // environment's dependency scan may load it (or its graph) from disk.
        return { optimizeDeps: { exclude: ["@marko/run/router"] } };
      },
      configResolved(config) {
        resolvedConfig = config;
        // Class W2: the resolver-relevant config slice gates the warm path.
        persistedPlanHost?.setConfigEpoch(
          computeConfigEpoch(
            configEpochSliceFromVite(config, {
              runtimeId: opts.runtimeId,
            }),
          ),
        );
        const {
          ssr,
          rolldownOptions: { input },
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
            const isRouteFanOutOnly =
              filename === runtimeInclude ||
              routableFileType === RoutableFileTypes.Handler ||
              routableFileType === RoutableFileTypes.Middleware;
            // Production W1: file events enter the coordinator's selective
            // reverse index. Route handlers/middleware/runtimeInclude are
            // W3 fan-out only: they rebuild route virtuals but never bump a
            // plan epoch or re-finalize unchanged templates.
            if (!isRouteFanOutOnly) {
              persistedPlanHost?.handleFileChange(filename);
            }
            if (
              (filename.startsWith(resolvedRoutesDir) && routableFileType) ||
              filename === runtimeInclude
            ) {
              if (
                type === "add" ||
                type === "unlink" ||
                (type === "change" &&
                  (routableFileType === RoutableFileTypes.Handler ||
                    routableFileType === RoutableFileTypes.Middleware ||
                    filename === runtimeInclude))
              ) {
                buildVirtualFilesResult = undefined;
                renderVirtualFilesResult = undefined;
                routeMarkoApiCache = undefined;

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
        if (isSSRBuild && shouldEmptyOutDir) {
          if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true });
          }
        }

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
          if (markoVitePluginOptions.persistedBuild) {
            markoVitePluginOptions.persistedBuild.planEntries = routes.list
              .filter((route) => route.page && route.templateFilePath)
              .map((route) => normalizePath(route.templateFilePath!));
          }
        } else {
          // Build routes and generate code
          // getExportsFromFile = isBuild
          //   ? getExportsFromFileBuild
          //   : getExportsFromFileDev.bind(null, devServer);
        }
      },
      async resolveId(importee, importer) {
        let virtualFilePath: string | undefined;

        const aliasTarget = artifactAliases.get(importee);
        if (aliasTarget) {
          return aliasTarget;
        } else if (ordinaryCanonicalByVirtual.has(importee)) {
          return importee;
        } else if (
          importer &&
          ordinaryCanonicalByVirtual.has(importer) &&
          (importee.startsWith(".") || importee.startsWith("/"))
        ) {
          return await this.resolve(
            importee,
            ordinaryCanonicalByVirtual.get(importer),
            { skipSelf: true },
          );
        } else if (artifactVirtualFiles.has(importee)) {
          // Artifact bodies have top-level registration side effects; keep
          // bare importers (setup → merge) from tree-shaking them away.
          return { id: importee, moduleSideEffects: true };
        } else if (importee === "@marko/run/router") {
          return normalizePath(path.resolve(root, ROUTER_FILENAME));
        } else if (
          importee.endsWith(".marko") &&
          importee.includes(relativeEntryFilesDirPosix)
        ) {
          if (!importee.startsWith(root)) {
            importee = path.resolve(root, "." + importee);
          }
        } else if (importee.startsWith(virtualFilePrefix)) {
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
          return importee;
        } else if (virtualFilePath) {
          const filePath = path.resolve(__dirname, "..", virtualFilePath);
          return await this.resolve(filePath, importer, {
            skipSelf: true,
          });
        }
      },
      async load(id) {
        if (artifactVirtualFiles.has(id)) {
          return artifactVirtualFiles.get(id)!;
        } else if (ordinaryCanonicalByVirtual.has(id)) {
          const canonical = ordinaryCanonicalByVirtual.get(id)!;
          const loaded = await this.load({ id: canonical });
          if (loaded?.code !== undefined) return loaded.code;
          const passthrough = artifactEmission?.passthroughs.find(
            (candidate) => candidate.virtualId === id,
          );
          this.error(
            `@marko/run: residual dynamic import in ${JSON.stringify(passthrough?.requestingModule)} targets unavailable canonical ${JSON.stringify(canonical)}`,
          );
        }
        if (!renderVirtualFilesResult || virtualFiles.has(id)) {
          // Virtual files are seeded with empty placeholders until
          // `renderVirtualFiles` completes, and the bundler can request one
          // while rendering is still in flight (eg. when a `+handler` or
          // `+middleware` module loaded to inspect its exports transitively
          // imports `@marko/run/router`), so a virtual file must always wait
          // for rendering to finish before its content is read.
          await renderVirtualFiles(this);
        }
        if (virtualFiles.has(id)) {
          return virtualFiles.get(id)!;
        } else if (
          !id.startsWith(entryFilesDirPosix) &&
          /[/\\]__marko-run__[^?/\\]+\.(js|marko)$/.exec(id)
        ) {
          return "";
        }
      },
    },
    ...markoVitePlugin(markoVitePluginOptions),
    {
      name: `${PLUGIN_NAME_PREFIX}:post`,
      enforce: "post",

      async buildStart() {
        if (
          !persisted ||
          !artifactEmissionActive ||
          !persistedPlanHost ||
          !isBuild ||
          isSSRBuild
        ) {
          return;
        }
        // @marko/vite's immediately preceding buildStart has compiled the
        // generated page entries and their persisted closure through its
        // authoritative compiler/resolver path.
        if (!hasLivePersistedHarvest(persistedPlanHost)) {
          this.error(
            "@marko/run: pre-bundle harvest published no client plans",
          );
        }
        publishArtifactEmission(persistedPlanHost, routes, "build");
      },

      async transform(code, id) {
        if (
          persisted &&
          artifactEmissionActive &&
          persistedPlanHost &&
          !isBuild &&
          routes &&
          isPersistedPageEntry(id, routes)
        ) {
          // Dev seal: @marko/vite's transform has already awaited harvest.
          // An incomplete streaming/HMR universe simply remains dirty; the
          // final page entry publishes the complete state atomically.
          const sealed = sealPersistedPartition(
            persistedPlanHost,
            routes,
            "dev",
          );
          if (sealed.state) {
            publishArtifactEmission(persistedPlanHost, routes, "dev");
          } else {
            clearArtifactEmission();
          }
        }
        if (!isBuild || isSSRBuild) {
          return;
        }

        // Record each persisted module's client shell registrations; the
        // wire can then omit shells the target route's closure provably
        // holds. Parsed, not pattern-matched: a template string containing
        // a key-like sequence must never mint a phantom claim.
        // `x.marko?persisted` resolves to `x.persisted-entry.marko`
        // (see @marko/vite's persisted facade); tolerate a trailing query.
        if (id.split("?")[0].endsWith(".persisted-entry.marko")) {
          recordStaticShellIds(
            staticShellIds,
            id,
            code.includes("_static_shells")
              ? findStaticShellIds(this.parse(code, { lang: "js" }))
              : undefined,
          );
        }

        if (!code.includes("Run.href")) {
          return;
        }

        try {
          const replacements = findHrefReplacements(
            code,
            this.parse(code, { lang: "js" }),
          );

          if (replacements.length) {
            const helpers = new Set<string>();
            const s = new RolldownMagicString(code);
            for (const { helper, edits } of replacements) {
              for (const { start, end, code } of edits) {
                if (code) {
                  s.overwrite(start, end, code);
                } else {
                  s.remove(start, end);
                }
              }
              if (helper) {
                helpers.add(helper);
              }
            }

            if (helpers.size) {
              s.prepend(
                `import { ${[...helpers].join(", ")} } from "virtual:marko-run/runtime/url-builder";`,
              );
            }
            return {
              code: s,
            };
          }

          return null;
        } catch {
          return {
            code: new RolldownMagicString(code).prepend(
              'import "virtual:marko-run/runtime/client";',
            ),
          };
        }
      },

      generateBundle(options, bundle) {
        if (
          persisted &&
          artifactEmissionActive &&
          persistedPlanHost &&
          isBuild &&
          !isSSRBuild &&
          hasLivePersistedHarvest(persistedPlanHost)
        ) {
          // Q5: assert/re-seal only. First registration happened during the
          // pre-plugin buildStart harvest, before routes.client loaded.
          const sealed = sealPersistedPartition(
            persistedPlanHost,
            routes,
            "build",
          ).state!;
          if (
            !artifactEmission ||
            artifactEmission.contentFingerprint !== sealed.inputFingerprint ||
            artifactPublicationToken !== JSON.stringify(sealed.publicationToken)
          ) {
            this.error(
              "@marko/run: generateBundle assertion failed: artifact emission generation does not match the sealed partition",
            );
          }
          for (const artifact of artifactEmission.artifacts) {
            if (!artifactVirtualFiles.has(artifact.virtualId)) {
              this.error(
                `@marko/run: generateBundle assertion failed: ${artifact.virtualId} was not registered`,
              );
            }
          }
          for (const facade of artifactEmission.facades) {
            if (!artifactVirtualFiles.has(facade.virtualId)) {
              this.error(
                `@marko/run: generateBundle assertion failed: ${facade.virtualId} was not registered`,
              );
            }
          }
          for (const passthrough of artifactEmission.passthroughs) {
            if (!ordinaryCanonicalByVirtual.has(passthrough.virtualId)) {
              this.error(
                `@marko/run: generateBundle assertion failed: ${passthrough.virtualId} was not registered for ${passthrough.canonical}`,
              );
            }
          }
          const emittedModules = new Set(
            artifactEmission.artifacts.flatMap(
              (artifact) => artifact.moduleKeys,
            ),
          );
          for (const item of Object.values(bundle)) {
            if (item.type !== "chunk") continue;
            for (const moduleId of Object.keys(item.modules)) {
              const normalized = normalizePath(moduleId);
              if (
                normalized.includes(".persisted-entry.marko") &&
                [...emittedModules].some(
                  (moduleKey) =>
                    normalizePath(moduleKey).split("?")[0] ===
                    normalized
                      .split("?")[0]
                      .replace(/\.persisted-entry\.marko$/, ".marko"),
                )
              ) {
                this.error(
                  `@marko/run: generateBundle assertion failed: residual eager dual-entry module ${moduleId}`,
                );
              }
            }
          }
        }
        if (options.sourcemap && options.sourcemap !== "inline") {
          // Iterate through bundle and remove source maps that don't have a corresponding source file
          for (const key of Object.keys(bundle)) {
            if (key.endsWith(".map") && !bundle[key.slice(0, -4)]) {
              delete bundle[key];
            }
          }
        }

        // Per route, the shells provably registered by loading its persisted
        // entry (the walk itself is unit-locked in utils/static-shells).
        if (
          isBuild &&
          !isSSRBuild &&
          !artifactEmission &&
          staticShellIds.size
        ) {
          shellManifest = collectShellManifest(
            routes.list
              .filter((route) => route.page && route.templateFilePath)
              .map((route) => ({
                index: route.index,
                entryModuleId: normalizePath(route.templateFilePath!).replace(
                  /\.marko$/,
                  ".persisted-entry.marko",
                ),
              })),
            bundle,
            staticShellIds,
          );
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
        } else {
          logRoutesTable(routes, [...externalRoutes], bundle);

          // Deliver the shell manifest the way @marko/vite delivers its
          // asset manifest: appended to the already-built server entries
          // (the SSR build runs first). The runtime reads it lazily per
          // request, so import evaluation order never races the append.
          if (shellManifest) {
            debug("persisted shell manifest: %o", shellManifest);
            const manifestStr = `\n;globalThis.__MARKO_RUN_SHELLS__=${JSON.stringify(
              shellManifest,
            )};\n`;
            for (const entry of routeData.builtEntries) {
              // Replace any prior append (a repeated browser build against
              // the same server output must not stack assignments).
              const source = await fs.promises.readFile(entry, "utf-8");
              const previous = source.indexOf(
                "\n;globalThis.__MARKO_RUN_SHELLS__=",
              );
              await fs.promises.writeFile(
                entry,
                (previous === -1
                  ? source
                  : source.slice(0, previous) +
                    source.slice(source.indexOf("\n", previous + 1) + 1)) +
                  manifestStr,
              );
            }
          }
        }
      },
      async closeBundle() {
        if (isBuild && !isSSRBuild) {
          if (fs.existsSync(entryFilesDir)) {
            fs.rmSync(entryFilesDir, { recursive: true });
          }

          if (adapter?.buildEnd && routes) {
            await adapter.buildEnd({
              routes,
              config: resolvedConfig,
              builtEntries: routeData.builtEntries,
              sourceEntries: routeData.sourceEntries,
            });
          }
        }
      },
    },
  ];
}

function partitionSealRoutes(routes: BuiltRoutes) {
  return routes.list
    .filter((route) => route.page && route.templateFilePath)
    .map((route) => ({
      routeIndex: route.index,
      templateFilePath: normalizePath(route.templateFilePath!),
    }));
}

function sealPersistedPartition(
  host: PersistedPlanHost,
  routes: BuiltRoutes,
  mode: "build" | "dev",
) {
  return host.sealPartition(partitionSealRoutes(routes), mode);
}

function hasLivePersistedHarvest(host: PersistedPlanHost) {
  const stats = host.getGenerationStats().client;
  // Stock @marko/vite@6.1.6 never calls the host. It remains an explicitly
  // carried C0/C1 consumer residue; native C1 builds use the landed fork.
  return (
    stats.finalizeStarts > 0 ||
    stats.finalizeCommits > 0 ||
    stats.negativeEntries > 0
  );
}

function isPersistedPageEntry(id: string, routes: BuiltRoutes) {
  const moduleId = normalizePath(id.split("?")[0]).replace(
    /\.persisted-entry\.marko$/,
    ".marko",
  );
  return partitionSealRoutes(routes).some(
    (route) => route.templateFilePath === moduleId,
  );
}

function mergeOutputOptions(
  defaults: OutputOptions | OutputOptions[],
  existing: OutputOptions | OutputOptions[] | undefined,
): OutputOptions | OutputOptions[] {
  if (!existing) {
    return defaults;
  } else if (Array.isArray(existing)) {
    return existing.map((options) => ({
      ...defaults,
      ...options,
    }));
  }
  return {
    ...defaults,
    ...existing,
  };
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
    let dependencies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
    if (pkg.devDependencies) {
      dependencies = dependencies.concat(Object.keys(pkg.devDependencies));
    }

    for (const name of dependencies) {
      if (
        name.startsWith("@marko/run-adapter") ||
        name.indexOf("marko-run-adapter") !== -1
      ) {
        try {
          const module = await import(/* @vite-ignore */ name);
          log &&
            debug(
              `Using adapter ${name} listed in your package.json dependencies`,
            );
          return module.default();
        } catch (err) {
          log && debug(`Attempt to use package '${name}' failed %O`, err);
        }
      }
    }
  }

  const defaultAdapter = "@marko/run/adapter";
  const module = await import(/* @vite-ignore */ defaultAdapter);
  log && debug("Using default adapter");
  return module.default();
}

const markoEntryFileRegex = /([^/\\]+)\.marko$/;
function getEntryFileName(file: string | undefined | null) {
  const match = file && markoEntryFileRegex.exec(file);
  return match ? match[1] : undefined;
}

function cleanFileName(name: string) {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9._[\]-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function getPlugin(config: ResolvedConfig):
  | Plugin<{
      addExternalRoutes(routes: ExternalRoutes): () => void;
    }>
  | undefined {
  return config.plugins.find(
    (plugin) => plugin.name === `${PLUGIN_NAME_PREFIX}:pre`,
  );
}

export function isPluginIncluded(config: ResolvedConfig) {
  return !!getPlugin(config);
}

export function getApi(config: ResolvedConfig) {
  const plugin = getPlugin(config);
  if (!plugin) {
    throw new Error("Marko Run vite plugin not found");
  }
  return plugin.api!;
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

export const defaultConfigPlugin: Plugin = {
  name: `${PLUGIN_NAME_PREFIX}:defaults`,
  enforce: "pre",
  config(config) {
    return {
      server: {
        port: config.server?.port ?? defaultPort,
      },
      preview: {
        port: config.preview?.port ?? defaultPort,
      },
    };
  },
};

function getBrowserslistTargets(path: string) {
  const browserslistTarget = browserslist(undefined, { path });
  if (browserslistTarget.length) {
    const versions = new Map<string, number>();
    for (const target of resolveToEsbuildTarget(browserslistTarget, {
      printUnknownTargets: false,
    })) {
      const index = /\d/.exec(target)?.index;
      if (index) {
        const browser = target.slice(0, index);
        const version = Number(target.slice(index));
        const existingVersion = versions.get(browser);
        if (!existingVersion || version < existingVersion) {
          versions.set(browser, version);
        }
      }
    }
    if (versions.size) {
      const targets = [];
      for (const [browser, version] of versions) {
        targets.push(browser + version);
      }
      return targets;
    }
  }
}

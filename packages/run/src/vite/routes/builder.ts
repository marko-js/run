import { RoutableFileTypes, markoRunFilePrefix } from "../constants";
import VDir from "./vdir";
import type {
  BuiltRoutes,
  RoutableFile,
  Route,
  RoutableFileType,
  SpecialRoutes,
} from "../types";
import type { WalkOptions, Walker } from "./walk";
import { parseFlatRoute } from "./parse";

const markoFiles = `(${RoutableFileTypes.Layout}|${RoutableFileTypes.Page}|${RoutableFileTypes.NotFound}|${RoutableFileTypes.Error})\\.(?:.*\\.)?(marko)`;
const nonMarkoFiles = `(${RoutableFileTypes.Middleware}|${RoutableFileTypes.Handler}|${RoutableFileTypes.Meta})\\.(?:.*\\.)?(.+)`;
const routeableFileRegex = new RegExp(
  `[+](?:${markoFiles}|${nonMarkoFiles})$`,
  "i"
);

export function isRoutableFile(filename: string) {
  return routeableFileRegex.test(filename);
}

export function matchRoutableFile(filename: string) {
  const match = filename.match(routeableFileRegex);
  return match && ((match[1] || match[3]).toLowerCase() as RoutableFileType);
}

export function isSpecialType(
  type: RoutableFileType
): type is keyof SpecialRoutes {
  return (
    type === RoutableFileTypes.NotFound || type === RoutableFileTypes.Error
  );
}

export interface RouteSource {
  walker: Walker,
  importPrefix?: string,
  basePath?: string
}

export async function buildRoutes(sources: RouteSource | RouteSource[]): Promise<BuiltRoutes> {

  const uniqueRoutes = new Map<string, { dir: VDir; index: number }>();
  const routes: Route[] = [];
  const special: SpecialRoutes = {};

  const middlewares = new Set<RoutableFile>();
  const unusedFiles = new Set<RoutableFile>();

  const currentLayouts = new Set<RoutableFile>();
  const currentMiddleware = new Set<RoutableFile>();

  const root = new VDir();
  const dirStack: string[] = [];

  let basePath: string;
  let importPrefix: string;
  let activeDirs: VDir[];
  let isBaseDir: boolean;
  
  let nextFileId = 1;
  let nextRouteIndex = 1;

  const walkOptions: WalkOptions = {
    onEnter({ name }) {
      const prevDirStackLength = dirStack.length;

      if (isBaseDir) {
        isBaseDir = false;
        if (!basePath) {
          return;
        }
        name = basePath;
      } else {
        dirStack.push(name);
      }

      const previousDirs = activeDirs;
      const paths = parseFlatRoute(name); // get paths for name
      activeDirs = VDir.addPaths(previousDirs, paths);

      return () => {
        activeDirs = previousDirs;
        dirStack.length = prevDirStackLength;
      };
    },
    onFile({ name, path }) {
      const match = name.match(routeableFileRegex);
      if (!match) {
        return;
      }

      const type = (match[1] || match[3]).toLowerCase() as RoutableFileType;

      if (dirStack.length && isSpecialType(type)) {
        console.warn(
          `Special pages '${RoutableFileTypes.NotFound}' and '${RoutableFileTypes.Error}' are only considered in the root directory - ignoring ${path}`
        );
        return;
      }

      let dirs = activeDirs;
      if (match.index) {
        const paths = parseFlatRoute(name.slice(0, match.index));
        dirs = VDir.addPaths(activeDirs, paths);
      }

      const dirPath = dirStack.join("/");
      const relativePath = dirPath ? `${dirPath}/${name}` : name;
      const file: RoutableFile = {
        id: String(nextFileId++),
        name,
        type,
        filePath: path,
        relativePath,
        importPath: `${importPrefix}/${relativePath}`,
        verbs: type === RoutableFileTypes.Page ? ["get"] : undefined,
      };

      for (const dir of dirs) {
        dir.addFile(file);
      }
    },
  };

  if (!Array.isArray(sources)) {
    sources = [sources];
  }

  for (const source of sources) {
    importPrefix = source.importPrefix ? source.importPrefix.replace(/^\/+|\/+$/g, "") : '';
    basePath = source.basePath || ''
    activeDirs = [root];
    isBaseDir = true;
    await source.walker(walkOptions);
  }

  traverse(root);

  return {
    list: routes,
    middleware: [...middlewares],
    special,
  };

  function traverse(dir: VDir) {
    let middleware: RoutableFile | undefined;
    let layout: RoutableFile | undefined;

    if (dir.files) {
      middleware = dir.files.get(RoutableFileTypes.Middleware);
      layout = dir.files.get(RoutableFileTypes.Layout);
      const handler = dir.files.get(RoutableFileTypes.Handler);
      const page = dir.files.get(RoutableFileTypes.Page);
      let hasSpecial = false;

      if (middleware) {
        if (currentMiddleware.has(middleware)) {
          middleware = undefined;
        } else {
          currentMiddleware.add(middleware);
          unusedFiles.add(middleware);
        }
      }
      if (layout) {
        if (currentLayouts.has(layout)) {
          layout = undefined;
        } else {
          currentLayouts.add(layout);
          unusedFiles.add(layout);
        }
      }
      if (page || handler) {
        const path = dir.pathInfo;

        if (uniqueRoutes.has(path.id)) {
          const existing = uniqueRoutes.get(path.id)!;
          const route = routes[existing.index];

          const existingFiles = [route.handler, route.page]
            .filter(Boolean)
            .map((f) => f!.filePath);
          const currentFiles = [handler, page]
            .filter(Boolean)
            .map((f) => f!.filePath);
          throw new Error(`Duplicate routes for path '${
            path.path
          }' were defined. A route established by:
      ${existingFiles.join(" and ")} via '${existing.dir.path}'
        collides with
      ${currentFiles.join(" and ")} via '${dir.path}'
      `);
        }

        uniqueRoutes.set(path.id, { dir, index: routes.length });
        routes.push({
          index: nextRouteIndex++,
          key: dir.fullPath,
          paths: [path],
          middleware: [...currentMiddleware],
          layouts: page ? [...currentLayouts] : [],
          meta: dir.files.get(RoutableFileTypes.Meta),
          page,
          handler,
          entryName:
            `${markoRunFilePrefix}route` +
            (dir.path !== "/" ? dir.fullPath.replace(/\//g, ".").replace(/(%[A-Fa-f0-9]{2})+/g, '_') : ""),
        });
      }

      if (dir === root) {
        for (const [type, file] of dir.files) {
          if (isSpecialType(type)) {
            hasSpecial = true;
            special[type] = {
              index: 0,
              key: type,
              paths: [],
              middleware: [],
              layouts: [...currentLayouts],
              page: file,
              entryName: `${markoRunFilePrefix}special.${type}`,
            };
          }
        }
      }

      if (handler || page) {
        for (const middleware of currentMiddleware) {
          middlewares.add(middleware);
          unusedFiles.delete(middleware);
        }
      }

      if (page || hasSpecial) {
        for (const layout of currentLayouts) {
          unusedFiles.delete(layout);
        }
      }
    }

    if (dir.dirs) {
      for (const child of dir.dirs()) {
        traverse(child);
      }
    }

    if (middleware) {
      currentMiddleware.delete(middleware);
    }
    if (layout) {
      currentLayouts.delete(layout);
    }
  }
}

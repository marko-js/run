import path from "path";

import { RoutableFileTypes } from "../constants";
import type {
  BuiltRoutes,
  RoutableFile,
  RoutableFileType,
  Route,
  SpecialRoutes,
} from "../types";
import { parseFlatRoute } from "./parse";
import VDir from "./vdir";
import type { Walker, WalkOptions } from "./walk";

const markoFiles = `(${RoutableFileTypes.Layout}|${RoutableFileTypes.Page}|${RoutableFileTypes.NotFound}|${RoutableFileTypes.Error})\\.(?:.*\\.)?(marko)`;
const nonMarkoFiles = `(${RoutableFileTypes.Middleware}|${RoutableFileTypes.Handler}|${RoutableFileTypes.Meta})\\.(?:.*\\.)?(.+)`;
const routeableFileRegex = new RegExp(
  `[+](?:${markoFiles}|${nonMarkoFiles})$`,
  "i",
);

export function isRoutableFile(filename: string) {
  return routeableFileRegex.test(filename);
}

export function matchRoutableFile(filename: string) {
  const match = filename.match(routeableFileRegex);
  return match && ((match[1] || match[3]).toLowerCase() as RoutableFileType);
}

export interface RouteSource {
  walker: Walker;
  basePath?: string;
}

export async function buildRoutes(
  sources: RouteSource | RouteSource[],
  outDir: string,
): Promise<BuiltRoutes> {
  const uniqueRoutes = new Map<string, { dir: VDir; index: number }>();
  const routes: Route[] = [];
  const special: SpecialRoutes = {};
  const seenKeys = new Set<string>();

  const middlewares = new Set<RoutableFile>();
  const unusedFiles = new Set<RoutableFile>();

  const currentLayouts = new Set<RoutableFile>();
  const currentMiddleware = new Set<RoutableFile>();

  const root = new VDir();
  const dirStack: string[] = [];

  let basePath: string;
  let activeDirs: VDir[];
  let isBaseDir: boolean;

  let nextFileId = 1;
  let nextRouteIndex = 1;

  const walkOptions: WalkOptions = {
    onEnter(dir) {
      let { name } = dir;
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
      const paths = parseFlatRoute(name);
      activeDirs = VDir.addPaths(previousDirs, paths);

      return () => {
        activeDirs = previousDirs;
        dirStack.length = prevDirStackLength;
      };
    },
    onFile(file) {
      const { name } = file;
      const match = name.match(routeableFileRegex);
      if (!match) {
        return;
      }

      const type = (match[1] || match[3]).toLowerCase() as RoutableFileType;

      if (
        dirStack.length &&
        (type === RoutableFileTypes.NotFound ||
          type === RoutableFileTypes.Error)
      ) {
        console.warn(
          `Special pages '${RoutableFileTypes.NotFound}' and '${RoutableFileTypes.Error}' are only considered in the root directory - ignoring ${file.path}`,
        );
        return;
      }

      let dirs = activeDirs;
      if (match.index) {
        const paths = parseFlatRoute(name.slice(0, match.index));
        dirs = VDir.addPaths(activeDirs, paths);
      }

      const routableFile: RoutableFile = {
        id: String(nextFileId++),
        name,
        type,
        filePath: file.path,
        verbs: type === RoutableFileTypes.Page ? ["get", "head"] : undefined,
      };

      for (const dir of dirs) {
        dir.addFile(routableFile);
      }
    },
  };

  if (!Array.isArray(sources)) {
    sources = [sources];
  }

  for (const source of sources) {
    basePath = source.basePath || "";
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
      const pathInfo = dir.pathInfo;

      let layoutsUsed = false;

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

      if (dir === root) {
        for (const [type, file] of dir.files) {
          if (
            type === RoutableFileTypes.NotFound ||
            type === RoutableFileTypes.Error
          ) {
            special[type] = {
              index: nextRouteIndex++,
              key: type,
              path: dir.pathInfo,
              middleware: [],
              layouts: [...currentLayouts],
              page: file,
              templateFilePath: currentLayouts.size
                ? path.join(outDir, `${type}.marko`)
                : undefined,
            };

            layoutsUsed = true;
          }
        }
      }

      if (page || handler) {
        if (uniqueRoutes.has(pathInfo.id)) {
          const existing = uniqueRoutes.get(pathInfo.id)!;
          const route = routes[existing.index];

          const existingFiles = [route.handler, route.page]
            .filter(Boolean)
            .map((f) => f!.filePath);
          const currentFiles = [handler, page]
            .filter(Boolean)
            .map((f) => f!.filePath);
          throw new Error(
            `Duplicate routes for path ${
              pathInfo.id
            } were defined. A route established by: "${existingFiles.join(" and ")}" collides with "${currentFiles.join(" and ")}"`,
          );
        }

        uniqueRoutes.set(pathInfo.id, { dir, index: routes.length });

        const keyBase =
          pathInfo.segments.map(replaceInvalidFilenameChars).join(".") ||
          "index";

        let count = 2;
        let key = keyBase;
        while (seenKeys.has(key)) {
          key = keyBase + count++;
        }
        seenKeys.add(key);

        routes.push({
          index: nextRouteIndex++,
          key,
          path: pathInfo,
          middleware: [...currentMiddleware],
          layouts: page ? [...currentLayouts] : [],
          meta: dir.files.get(RoutableFileTypes.Meta),
          page,
          handler,
          templateFilePath:
            page && currentLayouts.size
              ? path.join(outDir, key + ".marko")
              : undefined,
        });

        layoutsUsed = !!page;
        for (const middleware of currentMiddleware) {
          middlewares.add(middleware);
          unusedFiles.delete(middleware);
        }
      }

      if (layoutsUsed) {
        for (const layout of currentLayouts) {
          unusedFiles.delete(layout);
        }
      }
    }

    for (const childDir of dir.dirs()) {
      traverse(childDir);
    }

    if (middleware) {
      currentMiddleware.delete(middleware);
    }
    if (layout) {
      currentLayouts.delete(layout);
    }
  }
}

function replaceInvalidFilenameChars(str: string) {
  return str.replace(/[<>:"/\\|?*_]+/g, "-");
}

import { RoutableFileTypes, markoRunFilePrefix } from "../constants";
import type {
  BuiltRoutes,
  RoutableFile,
  Route,
  RoutableFileType,
  SpecialRoutes,
  PathInfo,
} from "../types";
import type { Walker } from "./walk";

interface RouteDirectoryInfo {
  parent: RouteDirectoryInfo | null;
  name: string;
  dirPath: string;
  paths: PathInfo[];
  files: Map<RoutableFileType, RoutableFile[]>;
  middlewares: RoutableFile[];
  layouts: RoutableFile[];
}

const markoFiles = `(${RoutableFileTypes.Layout}|${RoutableFileTypes.Page}|${RoutableFileTypes.NotFound}|${RoutableFileTypes.Error})\\.(?:.*\\.)?(marko)`;
const nonMarkoFiles = `(${RoutableFileTypes.Middleware}|${RoutableFileTypes.Handler}|${RoutableFileTypes.Meta})\\.(?:.*\\.)?(.+)`;
const routeableFileRegex = new RegExp(
  `^[+](?:${markoFiles}|${nonMarkoFiles})$`,
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

export async function buildRoutes(
  walk: Walker,
  basePath?: string
): Promise<BuiltRoutes> {
  if (basePath) {
    basePath = basePath.replace(/^\/+|\/+$/g, "");
  }

  const uniquePaths = new Map<string, Route>();
  const routes: Route[] = [];
  const special: SpecialRoutes = {};
  const allMiddlewares: RoutableFile[] = [];

  let nextFileId = 1;
  let nextRouteIndex = 1;
  let currentDir: RouteDirectoryInfo;

  await walk({
    onEnter({ name }) {
      if (currentDir) {
        currentDir = {
          parent: currentDir,
          name,
          dirPath: currentDir.dirPath ? `${currentDir.dirPath}/${name}` : name,
          files: new Map(),
          middlewares: [...currentDir.middlewares],
          layouts: [...currentDir.layouts],
          get paths() {
            const value = evaluatePaths(this.name, this.parent!.paths);
            Object.defineProperty(this, "paths", { value });
            return value;
          },
        };
      } else {
        currentDir = {
          parent: null,
          name,
          dirPath: "",
          files: new Map(),
          middlewares: [],
          layouts: [],
          paths: [
            {
              id: "",
              path: `/`,
              segments: [],
            },
          ],
        };
      }

      return () => {
        currentDir = currentDir.parent!;
      };
    },
    onFile({ name, path }) {
      const type = matchRoutableFile(name);
      if (!type) {
        return;
      }
      if (currentDir.parent && isSpecialType(type)) {
        console.warn(
          `Special pages '${RoutableFileTypes.NotFound}' and '${RoutableFileTypes.Error}' are only considered in the root directory - ignoring ${path}`
        );
        return;
      }

      let entries = currentDir.files.get(type);
      if (!entries) {
        currentDir.files.set(type, (entries = []));
      }

      const relativePath = currentDir.dirPath
        ? `${currentDir.dirPath}/${name}`
        : name;

      entries.push({
        id: String(nextFileId++),
        name,
        type,
        filePath: path,
        relativePath,
        importPath: `${basePath}/${relativePath}`,
        verbs: type === RoutableFileTypes.Page ? ["get"] : undefined,
      });
    },
    onDir() {
      let shouldContinue = true;

      const middleware = currentDir.files.get(
        RoutableFileTypes.Middleware
      )?.[0];
      const layout = currentDir.files.get(RoutableFileTypes.Layout)?.[0];
      const handler = currentDir.files.get(RoutableFileTypes.Handler)?.[0];
      const page = currentDir.files.get(RoutableFileTypes.Page)?.[0];

      if (middleware) {
        currentDir.middlewares.push(middleware);
        allMiddlewares.push(middleware);
      }
      if (layout) {
        currentDir.layouts.push(layout);
      }

      if (handler || page) {
        shouldContinue = false;
        for (const { id, path, isEnd } of currentDir.paths) {
          shouldContinue ||= !isEnd;

          if (uniquePaths.has(id)) {
            const existing = uniquePaths.get(id)!;
            const existingFiles = [existing.handler, existing.page]
              .filter(Boolean)
              .map((f) => f!.filePath);
            const currentFiles = [handler, page]
              .filter(Boolean)
              .map((f) => f!.filePath);
            throw new Error(`Duplicate routes for path ${path} were defined. A route established by:
${existingFiles}
  collides with
${currentFiles.join(" and ")}
`);
          }
        }

        routes.push({
          index: nextRouteIndex++,
          key: "/" + currentDir.dirPath,
          paths: currentDir.paths,
          middleware: [...currentDir.middlewares],
          layouts: page ? [...currentDir.layouts] : [],
          meta: currentDir.files.get(RoutableFileTypes.Meta)?.[0],
          page,
          handler,
          entryName:
            `${markoRunFilePrefix}route` +
            (currentDir.dirPath
              ? "." + currentDir.dirPath.replace(/\//g, ".")
              : ""),
        });
      }

      if (!currentDir.parent) {
        for (const [type, entries] of currentDir.files) {
          if (isSpecialType(type)) {
            special[type] = {
              index: 0,
              key: type,
              paths: [],
              middleware: [],
              layouts: [...currentDir.layouts],
              page: entries[0],
              entryName: `${markoRunFilePrefix}special.${type}`,
            };
          }
        }
      }

      // Return false if only path was a catch-all to prevent walking any deeper
      return shouldContinue;
    },
  });

  return {
    list: [...routes.values()],
    special,
    middleware: [...allMiddlewares],
  };
}

export function evaluatePaths(
  dirName: string,
  basePaths: PathInfo[]
): PathInfo[] {
  if (!basePaths.length) {
    throw new Error("Argument `basePaths` cannot be empty");
  }

  const paths = new Map<string, PathInfo>();
  const segments = new Map<string, string | undefined>(); // key is segment type ('$' | '$$' | string), value is parameter nane
  let hasPathless = false;
  let prevSplitIndex = 0;

  // split on ','
  do {
    const splitIndex = dirName.indexOf(",", prevSplitIndex) + 1;
    const name = dirName.slice(
      prevSplitIndex,
      splitIndex ? splitIndex - 1 : undefined
    );
    prevSplitIndex = splitIndex;

    if (!name || name.charCodeAt(0) === 95) {
      // Pathless segment -- name is empty or starts with '_'
      if (!hasPathless) {
        hasPathless = true;
        for (const basePath of basePaths) {
          paths.set(basePath.id, basePath);
        }
      }
    } else if (name.charCodeAt(0) === 36) {
      let type: string;
      let param: string;
      if (name.charCodeAt(1) === 36) {
        // Catch-all dynamic segment -- name starts with '$$'
        type = name.slice(0, 2);
        param = name.slice(2);
      } else {
        // Simple dynamic segment -- name starts with '$'
        type = name.charAt(0);
        param = name.slice(1);
      }
      if (!segments.has(type) || (!segments.get(type) && param)) {
        // Prefer segment with named param
        segments.set(type, param);
      }
    } else if (!segments.has(name)) {
      // Static segment
      segments.set(name, undefined);
    }
  } while (prevSplitIndex);

  for (const basePath of basePaths) {
    if (basePath.isEnd) {
      continue;
    }

    for (const [type, param] of segments) {
      const id = basePath.id ? `${basePath.id}/${type}` : type;
      if (!paths.has(id)) {
        const name = param ? type + param : type;
        const isEnd = type === "$$";
        paths.set(id, {
          ...basePath,
          id,
          path: basePath.path !== "/" ? `${basePath.path}/${name}` : `/${name}`,
          segments: [...basePath.segments, type],
          isEnd,
          params: param
            ? {
                ...basePath.params,
                [param]: isEnd ? null : basePath.segments.length,
              }
            : basePath.params,
        });
      }
    }
  }

  return [...paths.values()];
}

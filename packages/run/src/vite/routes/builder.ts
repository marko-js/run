import { RoutableFileTypes } from "../constants";
import type {
  BuiltRoutes,
  RoutableFile,
  Route,
  ParamInfo,
  RoutableFileType,
  SpecialRoutes,
} from "../types";
import type { Walker } from "./walk";

interface RouteDirectoryInfo {
  originalPath: string;
  path: string;
  children: RouteDirectoryInfo[];
  files: Map<RoutableFileType, RoutableFile[]>;
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

export function scorePath(path: string, index: number): number {
  const [pattern, splat] = path.split("/$$", 2);
  const segments = pattern.split("/").filter(Boolean);
  return (
    segments.reduce(
      (score, segment) => score + (segment.startsWith("$") ? 3 : 4),
      segments.length + (splat === undefined ? 1 : 2)
    ) * 10000 - index
  );
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
  const dirStack: string[] = basePath ? basePath.split("/") : [];
  const pathStack: string[] = [];
  const paramStack: ParamInfo[] = [];
  const layoutsStack: RoutableFile[] = [];
  const middlewareStack: RoutableFile[] = [];

  const routes = new Map<string, Route>();
  const special: SpecialRoutes = {};

  let isRoot = true;
  let nextId = 1;
  let current: RouteDirectoryInfo | undefined;
  let children: RouteDirectoryInfo[] = [];

  await walk({
    onFile(entry) {
      const type = matchRoutableFile(entry.name);
      if (!type) {
        return;
      }
      if (!isRoot && isSpecialType(type)) {
        console.warn(
          `Special pages '${RoutableFileTypes.NotFound}' and '${RoutableFileTypes.Error}' are only considered in the root directory - ignoring ${entry.path}`
        );
        return;
      }

      if (!current) {
        current = {
          path: "/" + pathStack.join("/"),
          originalPath: dirStack.join("/"),
          children: [],
          files: new Map(),
        };
        children.push(current);
      }

      let entries = current.files.get(type);
      if (!entries) {
        current.files.set(type, (entries = []));
      }
      entries.push({
        type,
        filePath: entry.path,
        importPath: `${current.originalPath}/${entry.name}`,
        name: entry.name,
        verbs: type === RoutableFileTypes.Page ? ["get"] : undefined,
      });
    },
    onDir(dir) {
      if (!current) {
        return;
      }

      const { path, files } = current;
      const middleware = files.get(RoutableFileTypes.Middleware)?.[0];
      const layout = files.get(RoutableFileTypes.Layout)?.[0];
      const handler = files.get(RoutableFileTypes.Handler)?.[0];
      const page = files.get(RoutableFileTypes.Page)?.[0];

      const middlewareStackLength = middlewareStack.length;
      const layoutsStackLength = layoutsStack.length;
      middleware && middlewareStack.push(middleware);
      layout && layoutsStack.push(layout);

      if (handler || page) {
        const key =
          path
            .replace(/(\$\$?)[^\/]*/g, "$1")
            .replace(/^\/+/, "")
            .replace(/[^a-z0-9_$\/]+/gi, "")
            .replace(/\//g, "__") || "index";

        if (routes.has(key)) {
          console.warn(`Duplicate route for path ${path} -- ignoring`, current);
        } else {
          const index = nextId++;
          routes.set(key, {
            index,
            key,
            path,
            params: [...paramStack],
            middleware: [...middlewareStack],
            layouts: page ? [...layoutsStack] : [],
            meta: files.get(RoutableFileTypes.Meta)?.[0],
            page,
            handler,
            score: scorePath(path, index),
          });
        }
      }

      if (isRoot) {
        for (const [type, entries] of files) {
          if (isSpecialType(type)) {
            special[type] = {
              index: 0,
              key: type,
              path,
              middleware: [],
              layouts: [...layoutsStack],
              page: entries[0],
              score: 0,
            };
          }
        }
      } else if (dir.startsWith("$$")) {
        // returing false prevents us from walking any deeper which is not necessary in $$ catch-all directories
        return false;
      }

      return () => {
        middlewareStack.length = middlewareStackLength;
        layoutsStack.length = layoutsStackLength;
      };
    },
    onEnter({ name }) {
      const pathStackLength = pathStack.length;
      const paramStackLength = paramStack.length;
      const prevChildren = children;
      const prevCurrent = current;
      const prevIsRoot = isRoot;

      if (
        name.charCodeAt(0) === 95 ||
        (name.charCodeAt(0) === 40 && name.charCodeAt(name.length - 1) === 41) ||
        name.toLowerCase() === 'index'
      ) {
        // Is empty segment -- name starts with '_' OR starts with '(' and ends with ')'
      } else {
        if (name.charCodeAt(0) === 36) {
          // Is dynamic segment -- name starts with '$'
          if (name.charCodeAt(1) === 36) {
            // Is catch-all segment -- name starts with '$$'
            paramStack.push({
              name: name.slice(2) || "*",
              index: -1,
            });
          } else if (name.length > 1) {
            paramStack.push({
              name: name.slice(1),
              index: pathStackLength,
            });
          }
        }
        pathStack.push(name.toLowerCase());
      }
      dirStack.push(name);

      isRoot = false;
      if (current) {
        children = current.children;
        current = undefined;
      }

      return () => {
        dirStack.pop();
        pathStack.length = pathStackLength;
        paramStack.length = paramStackLength;
        children = prevChildren;
        current = prevCurrent;
        isRoot = prevIsRoot;
      };
    },
  });

  return {
    list: [...routes.values()],
    special,
  };
}

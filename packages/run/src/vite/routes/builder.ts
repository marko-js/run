import path from "path";

import { RoutableFileTypes } from "../constants";
import type {
  BuiltRoutes,
  Partials,
  RoutableFile,
  RoutableFileType,
  Route,
  SpecialRoutes,
} from "../types";
import { agentRouteFixGuide } from "../utils/agent-fix-guide";
import { parseFlatRoute } from "./parse";
import VDir, { findIgnoringCase } from "./vdir";
import type { Walker, WalkOptions } from "./walk";

const markoFileTypes = `${RoutableFileTypes.Layout}|${RoutableFileTypes.Page}|${RoutableFileTypes.NotFound}|${RoutableFileTypes.Error}`;
const markoFiles = `(${markoFileTypes})\\.(?:.*\\.)?(marko)`;
const nonMarkoFiles = `(${RoutableFileTypes.Middleware}|${RoutableFileTypes.Handler}|${RoutableFileTypes.Meta})\\.(?:.*\\.)?(.+)`;
const partialFiles = `@([^.@+]+)\\.(?:.*\\.)?marko`;
// `content`/`renderBody` are the layout's child body; `error` is the 500 page's input.
const reservedPartialNames = new Set(["content", "renderBody", "error"]);
const RoutableFileRegex = new RegExp(
  `(?:[+](?:${markoFiles}|${nonMarkoFiles})|${partialFiles})$`,
  "i",
);

export function isRoutableFile(filename: string) {
  return RoutableFileRegex.test(filename);
}

export interface RoutableFileMatch {
  type: RoutableFileType;
  index: number;
  partial: string;
}

export function matchRoutableFile(filename: string): RoutableFileMatch | null {
  const match = filename.match(RoutableFileRegex);
  if (!match) return null;
  const partial = match[5];
  return {
    type: partial
      ? RoutableFileTypes.Partial
      : ((match[1] || match[3]).toLowerCase() as RoutableFileType),
    index: match.index!,
    partial,
  };
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
  const currentPartials = new Map<string, RoutableFile[]>();
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
      const match = matchRoutableFile(name);
      if (!match) {
        warnNonRoutableLookalike(name, file.path);
        return;
      }

      const { type, partial } = match;

      if (partial) {
        if (reservedPartialNames.has(partial)) {
          throw new Error(
            `Partial name @${partial} is reserved: it would collide with the same-named property of a template's input. File ${file.path}.`,
          );
        }
      }

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
        partial,
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

    if (dir.partials) {
      for (const [name, file] of dir.partials) {
        let partials = currentPartials.get(name);
        if (!partials) {
          const overridden = findIgnoringCase(currentPartials, name)?.[0];
          if (overridden) {
            throw new Error(
              `Partial @${name} at path ${dir.path} does not match the casing of @${overridden.partial} which it overrides. File ${file.filePath} overrides ${overridden.filePath}.`,
            );
          }
          currentPartials.set(name, (partials = []));
        }
        partials.push(file);
      }
    }

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
              partials: snapshotPartials(),
              page: file,
              templateFilePath: path.join(outDir, `${type}.marko`),
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
          partials: page && snapshotPartials(),
          meta: dir.files.get(RoutableFileTypes.Meta),
          page,
          handler,
          templateFilePath: page && path.join(outDir, key + ".marko"),
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
    if (dir.partials) {
      for (const name of dir.partials.keys()) {
        const partials = currentPartials.get(name)!;
        partials.pop();
        if (!partials.length) {
          currentPartials.delete(name);
        }
      }
    }
  }

  function snapshotPartials(): Partials<RoutableFile> | undefined {
    if (!currentPartials.size) return;
    const partials: Partials<RoutableFile> = {};
    for (const [name, files] of currentPartials) {
      partials[name] = [...files];
    }
    return partials;
  }
}

function replaceInvalidFilenameChars(str: string) {
  return str.replace(/[<>:"/\\|?*_]+/g, "-");
}

// @ebay/arc names adaptive variants `file[flag].ext` and brackets directories
// too; stripped before classifying so `[` and `+` never read as route syntax.
const bracketFlagReg = /\[[^\]]*\]/g;

// Marko pulls colocated companions in through their template, so
// `+page.style.css` beside `+page.marko` is expected rather than a broken route.
const markoCompanionReg = new RegExp(
  `[+](?:${markoFileTypes})\\.(?:style|component|component-browser|marko\\.d)\\.[^.]+$`,
  "i",
);

function warnLookalike(message: string): void {
  // The cheat-sheet pointer is agent-gated; humans just see the convention.
  console.warn(`[marko-run] ${message}${agentRouteFixGuide()}`);
}

// Flags a file that looks like a botched route yet silently is not routable.
// Brackets alone never qualify: they are arc's syntax, not Marko Run's.
function warnNonRoutableLookalike(name: string, filePath: string): void {
  // `+page[mobile].marko` is arc's variant of a real `+page.marko`, not a break.
  const base = name.replace(bracketFlagReg, "");
  if (RoutableFileRegex.test(base) || markoCompanionReg.test(base)) return;

  const relativeFilePath = path.relative(process.cwd(), filePath);
  if (base.includes("+")) {
    const hint = /^\+server\./i.test(base)
      ? "request handlers are named `+handler.<ext>`"
      : "routable files are `+page.marko`, `+layout.marko`, `+handler.*`, `+middleware.*`, `+meta.*`, `+404.marko`, `+500.marko` and `@<name>.marko` partials";
    warnLookalike(`${relativeFilePath} is not routable; ${hint}.`);
  } else if (base[0] === "$") {
    const stem = base.replace(/\.[^.]+$/, "");
    const suggestion = /\.marko$/i.test(base)
      ? `${stem}+page.marko`
      : `${stem}+handler${base.slice(base.lastIndexOf("."))}`;
    warnLookalike(
      `${relativeFilePath} is not routable; route files need a \`+type\` suffix after their path segments, e.g. \`${suggestion}\`.`,
    );
  }
}

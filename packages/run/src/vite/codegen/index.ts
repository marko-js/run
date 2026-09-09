import path from "path";

import {
  httpVerbs,
  markoRunFilePrefix,
  type RoutableFileType,
  RoutableFileTypes,
  virtualFilePrefix,
} from "../constants";
import type {
  Adapter,
  BuiltRoutes,
  HttpVerb,
  PathInfo,
  RoutableFile,
  Route,
  RouterOptions,
} from "../types";
import { normalizePath } from "../utils/fs";
import { getRouteVirtualFileName, getVerbs, hasVerb } from "../utils/route";
import type { Writer } from "./writer";
import { createStringWriter } from "./writer";

interface RouteTrie {
  key: string;
  path?: PathInfo;
  route?: Route;
  catchAll?: { route: Route; path: PathInfo };
  static?: Map<string, RouteTrie>;
  dynamic?: RouteTrie;
}

export function renderRouteTemplate(
  route: Route,
  markoApi?: string,
  dev = false,
): string {
  if (!route.page) {
    throw new Error(`Route ${route.key} has no page to render`);
  }

  const writer = createStringWriter();
  if (markoApi) {
    writer.writeLines(`<!-- use ${markoApi} -->\n`);
  }

  const importWriter = writer.branch("imports");

  if (dev) {
    importWriter.writeLines(
      `client import "virtual:marko-run/runtime/client";`,
    );
  }

  writer.writeLines("");
  writeEntryTemplateTag(
    writer,
    [...route.layouts, route.page].map((file) =>
      normalizedRelativePath(
        path.dirname(route.templateFilePath!),
        file.filePath,
      ),
    ),
    route.key === RoutableFileTypes.Error ? ["error"] : [],
  );

  return writer.end();
}

/**
 * The one template of a persisted build: every page is a branch of a chain
 * that follows the layout tree, picked by `input.page` (`persistedPages`), so
 * a navigation is a branch change on a root every page shares. A page (and a
 * layout only some pages use) loads lazily, so a page ships what its own
 * route would have; the router installs from the template's own scope.
 */
export function renderPersistedApp(
  routes: BuiltRoutes,
  app: PersistedApp,
  dev = false,
  debug = false,
): string {
  const writer = createStringWriter();
  writer.writeLines("<!-- use tags -->\n");
  const imports = writer.branch("imports");
  if (dev) {
    imports.writeLines(`client import "virtual:marko-run/runtime/client";`);
  }
  imports.writeLines(
    `client import { patch } from "marko/${debug ? "debug/" : ""}dom";`,
    `client import { router } from "${virtualFilePrefix}/runtime/persisted";`,
  );

  const { pages } = app;
  const shared = new Map<RoutableFile, number>();
  for (const route of pages.keys()) {
    for (const layout of route.layouts) {
      shared.set(layout, (shared.get(layout) || 0) + 1);
    }
  }
  const names = new Map<RoutableFile, string>();
  const importName = (file: RoutableFile, name: string) => {
    let id = names.get(file);
    if (!id) {
      names.set(file, (id = `${name}${names.size}`));
      const lazy = shared.get(file) !== pages.size;
      imports.writeLines(
        `import ${id} from "${normalizedRelativePath(
          path.dirname(app.filePath),
          file.filePath,
        )}"${lazy ? ` with { load: "render" }` : ""};`,
      );
    }
    return id;
  };

  writer.writeLines(
    "",
    `<script>router(() => patch($global), ${pagesRegExp(routes)}, ${JSON.stringify(app.id)})</script>`,
  );
  writeBranches(pageTree(pages));
  return writer.end();

  function writeBranches(node: PageNode) {
    const branches = [...node.pages, ...node.children];
    const last = branches.length - 1;
    for (let i = 0; i <= last; i++) {
      const branch = branches[i];
      const tag = !last ? "" : !i ? "if" : i < last ? "else-if" : "else";
      if (tag) {
        writer.writeBlockStart(
          `<${tag}${tag === "else" ? "" : `=input.page<=${lastPage(branch)}`}>`,
        );
      }
      if ("pages" in branch) {
        writer.writeBlockStart(`<${importName(branch.layout!, "Layout")}>`);
        writeBranches(branch);
        writer.writeBlockEnd("</>");
      } else {
        writer.writeLines(
          `<${importName(branch.page!, "Page")}${
            branch.key === RoutableFileTypes.Error ? " error=input.error" : ""
          }/>`,
        );
      }
      if (tag) writer.writeBlockEnd("</>");
    }
  }

  function lastPage(branch: Route | PageNode): number {
    return "pages" in branch
      ? lastPage(branch.children.at(-1) || branch.pages.at(-1)!)
      : pages.get(branch)!;
  }
}

/** The persisted app template: where it is written and each page's branch. */
export interface PersistedApp {
  filePath: string;
  pages: Map<Route, number>;
  /** Names the build: a patch applies only between a document and frames of the same one. */
  id: string;
}

/**
 * Each page's branch index in the persisted app template: depth-first over
 * the layout tree so every subtree is a contiguous range, and the chain
 * decides a branch with one comparison.
 */
export function persistedPages(routes: BuiltRoutes) {
  const pages = new Map<Route, number>();
  const visit = (node: PageNode) => {
    for (const route of node.pages) pages.set(route, pages.size);
    for (const child of node.children) visit(child);
  };
  visit(
    pageTree(
      new Map(
        [...routes.list, ...(Object.values(routes.special) as Route[])]
          .filter((route) => route.page)
          .map((route) => [route, 0]),
      ),
    ),
  );
  return pages;
}

interface PageNode {
  layout?: RoutableFile;
  pages: Route[];
  children: PageNode[];
}

function pageTree(pages: Map<Route, number>) {
  const root: PageNode = { pages: [], children: [] };
  for (const route of pages.keys()) {
    let node = root;
    for (const layout of route.layouts) {
      let child = node.children.find((child) => child.layout === layout);
      if (!child)
        node.children.push((child = { layout, pages: [], children: [] }));
      node = child;
    }
    node.pages.push(route);
  }
  return root;
}

// One expression tells the client router whether a URL is a page; `$` is a
// dynamic segment, `$$` the rest of the path.
function pagesRegExp(routes: BuiltRoutes) {
  const patterns = routes.list
    .filter((route) => route.page)
    .map(
      ({ path: { segments } }) =>
        segments
          .map((segment) =>
            segment === "$$"
              ? "(?:\\/.*)?"
              : segment === "$"
                ? "\\/[^/]+"
                : "\\/" + segment.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"),
          )
          .join("") || "\\/",
    );
  return `/^(?:${patterns.join("|")})$/`;
}

export function renderRouteEntry(
  route: Route,
  rootDir: string,
  persisted?: PersistedApp,
): string {
  const { key, index, handler, page, middleware, meta } = route;
  const verbs = getVerbs(route);

  if (!verbs) {
    throw new Error(
      `Route ${key} doesn't have a handler or page for any HTTP verbs`,
    );
  }

  const writer = createStringWriter();
  const imports = writer.branch("imports");
  const runtimeImports: string[] = [];

  if (handler) {
    runtimeImports.push("normalizeHandler");
  }
  if (meta) {
    runtimeImports.push("normalizeMeta");
  }
  if (handler || middleware.length) {
    runtimeImports.push("call", "normalizeOptions");
  }
  if (page) {
    runtimeImports.push("render");
  }
  if (
    !page ||
    verbs.some(
      (verb) =>
        !(
          verb === "get" ||
          verb === "head" ||
          verb === "post" ||
          verb === "query"
        ),
    )
  ) {
    runtimeImports.push("noContent");
  }
  if (verbs.includes("head")) {
    runtimeImports.push("stripResponseBody");
  }

  if (runtimeImports.length) {
    imports.writeLines(
      `import { ${runtimeImports.join(
        ", ",
      )} } from "${virtualFilePrefix}/runtime/internal";`,
    );
  }

  if (middleware.length) {
    const names = middleware.map((m) => `mware${m.id}`);
    imports.writeLines(
      `import { ${names.join(
        ", ",
      )} } from "${virtualFilePrefix}/${markoRunFilePrefix}middleware.js";`,
    );
  }

  if (handler?.verbs?.length) {
    writer.writeLines("");

    const names: string[] = [];
    for (const verb of handler.verbs) {
      const importName = verb.toUpperCase();
      names.push(importName);
      writer.writeLines(
        `const ${verb}Handler = normalizeHandler(${importName}, '${importName}');`,
      );
    }
    imports.writeLines(
      `import { ${names.join(", ")} } from "${normalizedRelativePath(rootDir, handler.filePath)}";`,
    );
  }

  if (page) {
    imports.writeLines(
      `import page from "${normalizedRelativePath(
        rootDir,
        persisted ? persisted.filePath : route.templateFilePath!,
      )}";`,
    );
  }
  if (meta) {
    const metaName = `meta${index}`;
    const metaVerbsExports = verbs
      .map((verb) => {
        const name =
          verb === "head" && !handler?.verbs?.includes(verb)
            ? "GET"
            : verb.toUpperCase();
        return `${name}: ${verb}${index}_meta`;
      })
      .join(", ");

    writer.writeLines("");
    imports.writeLines(
      `import ${metaName} from "${normalizedRelativePath(rootDir, meta.filePath)}";`,
    );
    writer.writeLines(
      `export const { ${metaVerbsExports} } = normalizeMeta(${metaName});`,
    );
  }

  const optionsWriter = writer.branch("options").writeLines("");

  for (const verb of verbs) {
    writeRouteOptions(optionsWriter, route, verb);
    writeRouteEntryHandler(
      writer,
      route,
      verb,
      persisted ? `{ page: ${persisted.pages.get(route)} }` : "{}",
    );
  }

  optionsWriter.join();

  return writer.end();
}

export function renderRouter(
  routes: BuiltRoutes,
  rootDir: string,
  runtimeInclude?: string,
  options: RouterOptions = {
    trailingSlashes: "RedirectWithout",
  },
  persisted?: PersistedApp,
): string {
  const writer = createStringWriter();

  const hasErrorPage = Boolean(routes.special[RoutableFileTypes.Error]);
  const hasNotFoundPage = Boolean(routes.special[RoutableFileTypes.NotFound]);

  const imports = writer.branch("imports");

  if (runtimeInclude) {
    imports.writeLines(`import "${normalizePath(runtimeInclude)}";`);
  }

  imports.writeLines(
    `import { NotHandled, NotMatched, createContext${persisted ? ", usePersisted, acceptsPatch" : ""} } from "${virtualFilePrefix}/runtime/internal";`,
  );
  if (persisted) {
    imports.writeLines(`usePersisted(${JSON.stringify(persisted.id)});`);
  }

  for (const route of routes.list) {
    const verbs = getVerbs(route);
    const routeImports: string[] = [];
    for (const verb of verbs) {
      const verbName = `${verb}${route.index}`;
      routeImports.push(verbName);
      routeImports.push(`${verbName}_options`);
      if (route.meta) {
        routeImports.push(`${verbName}_meta`);
      }
    }
    imports.writeLines(
      `import { ${routeImports.join(", ")} } from "${virtualFilePrefix}/${getRouteVirtualFileName(route)}";`,
    );
  }
  for (const route of Object.values(routes.special) as Route[]) {
    imports.writeLines(
      `import page${route.key} from "${normalizedRelativePath(
        rootDir,
        persisted ? persisted.filePath : route.templateFilePath!,
      )}";`,
    );
  }
  const pageInput = (route: Route, rest = "") =>
    persisted
      ? `{ page: ${persisted.pages.get(route)}${rest && ","}${rest} }`
      : rest
        ? `{${rest} }`
        : "{}";
  // A page of the persisted app answers a patch request as well.
  const acceptsPage = persisted
    ? `context.request.headers.get('Accept')?.includes('text/html') || acceptsPatch(context.request)`
    : `context.request.headers.get('Accept')?.includes('text/html')`;

  writer
    .writeLines(
      `
globalThis.__marko_run__ = { match, fetch, invoke };
    `,
    )
    .writeBlockStart(`export function match(method, pathname) {`)
    .writeLines(
      `return match_internal(method, pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname)
};

function match_internal(method, pathname) {
  const len = pathname.length;`,
    )
    .writeBlockStart(`try {`)
    .writeBlockStart(`switch (method) {`);

  for (const verb of httpVerbs) {
    const filteredRoutes = routes.list.filter((route) => hasVerb(route, verb));
    if (filteredRoutes.length) {
      const trie = createRouteTrie(filteredRoutes);
      writer.writeLines(`case '${verb.toUpperCase()}':`);
      writer.writeBlockStart(`case '${verb.toLowerCase()}': {`);
      writeRouterVerb(writer, trie, verb);
      writer.writeBlockEnd("}");
    }
  }

  writer.writeBlockEnd("}").writeBlockEnd("} catch (error) {").indent++;
  writer
    .writeLines(
      "// A malformed percent-escape is an invalid URI: no route can match it.",
      "if (error instanceof URIError) return null;",
      "throw error;",
    )
    .writeBlockEnd("}")
    .writeLines("return null;")
    .writeBlockEnd("}");

  writer
    .writeLines("")
    .writeBlockStart(
      "export async function invoke(route, request, platform, url) {",
    );

  renderTrailingSlashPolicy(writer, options);

  writer.writeLines(
    "const context = createContext(route, request, platform, url);",
  );

  if (hasErrorPage) {
    writer.writeBlockStart("try {");
  }

  writer
    .writeBlockStart("if (route) {")
    .writeBlockStart("try {")
    .writeLines(
      "const response = await route.handler(context);",
      "if (response) return response;",
    ).indent--;
  writer
    .writeBlockStart("} catch (error) {")
    .writeLines(
      "if (error === NotHandled) return;",
      "if (error !== NotMatched) throw error;",
    )
    .writeBlockEnd("}")
    .writeBlockEnd("}");

  if (hasNotFoundPage) {
    writer.write(`
    if (${acceptsPage}) {
      return context.render(page404, ${pageInput(routes.special[RoutableFileTypes.NotFound]!)}, { status: 404 });
    }`);
  }

  writer.indent--;

  if (routes.list.length) {
    writer.writeLines(`
    return new Response(null, {
      status: 404,
    });`);
  }

  if (hasErrorPage) {
    writer
      .writeBlockStart(`} catch (error) {`)
      .writeBlockStart(`if (${acceptsPage}) {`)
      .writeLines(
        `return context.render(page500, ${pageInput(routes.special[RoutableFileTypes.Error]!, " error")}, { status: 500 });`,
      )
      .writeBlockEnd("}")
      .writeLines("throw error;")
      .writeBlockEnd("}");
  }

  writer.writeBlockEnd("}");

  renderFetch(writer);

  return writer.end();
}

export function renderMiddleware(
  middleware: RoutableFile[],
  rootDir: string,
): string {
  const writer = createStringWriter();
  const imports = writer.branch("imports");
  imports.writeLines(
    `import { normalizeHandler } from "${virtualFilePrefix}/runtime/internal";`,
  );

  writer.writeLines("");

  for (const { id, filePath } of middleware) {
    const importName = `middleware${id}`;
    imports.writeLines(
      `import ${importName} from "${normalizedRelativePath(rootDir, filePath)}";`,
    );
    writer.writeLines(
      `export const mware${id} = normalizeHandler(${importName});`,
    );
  }

  imports.join();
  return writer.end();
}

interface RoutableFileInfo {
  id: string;
  typeName: "Middleware" | "Handler" | "Template" | "Meta" | null;
  modulePath: string;
  routes: Set<Route>;
}

export async function renderRouteTypeInfo(
  routes: BuiltRoutes,
  outDir: string,
  adapter?: Adapter | null,
) {
  const writer = createStringWriter();
  writer.writeLines(
    `/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.

  AGENTS: before writing or changing route files, READ the cheat sheet shipped with @marko/run
  — require.resolve("@marko/run/cheatsheet.md"), typically node_modules/@marko/run/cheatsheet.md — for the
  routing, handler, middleware, and validation conventions this file's types describe.
*/
`,
    `import { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform } from "@marko/run/namespace";`,
    `import type * as $ from "@marko/run";`,
    "",
  );

  const headWriter = writer.branch("head");

  writer.writeLines("").writeBlockStart(`declare module "@marko/run" {`);

  if (adapter && adapter.typeInfo) {
    const platformType = await adapter.typeInfo((data) =>
      headWriter.write(data),
    );
    if (platformType) {
      writer.writeLines(`interface Platform extends ${platformType} {}\n`);
    }
  }

  headWriter.join();

  const fileInfoByType = new Map<
    RoutableFileType,
    Map<RoutableFile, RoutableFileInfo>
  >();

  let fileIndex = 1;

  function addFile(file: RoutableFile) {
    let group = fileInfoByType.get(file.type);
    if (!group) {
      fileInfoByType.set(file.type, (group = new Map()));
    }

    let info = group.get(file);
    if (!info) {
      info = {
        id: "",
        typeName: null,
        modulePath: stripTsExtension(
          normalizedRelativePath(outDir, file.filePath),
        ),
        routes: new Set(),
      };

      switch (file.type) {
        case RoutableFileTypes.Middleware:
          info.id = `M${group.size + 1}`;
          info.typeName = "Middleware";
          break;
        case RoutableFileTypes.Handler:
          info.id = `H${group.size + 1}`;
          info.typeName = "Handler";
          break;
        case RoutableFileTypes.Meta:
          info.id = `D${group.size + 1}`;
          info.typeName = "Meta";
          break;
        case RoutableFileTypes.Layout:
          info.id = `L${group.size + 1}`;
          info.typeName = "Template";
          break;
        case RoutableFileTypes.Page:
          info.id = `P${group.size + 1}`;
          info.typeName = "Template";
          break;
        case RoutableFileTypes.Error:
        case RoutableFileTypes.NotFound:
          info.id = "";
          info.typeName = "Template";
          break;
        default:
          info.id = `F${fileIndex++}`;
          break;
      }
      group.set(file, info);
    }
    return info;
  }

  writer.writeBlockStart(`interface App extends $.DefineRoutes<{`);

  for (const route of routes.list) {
    let routeDefFiles = "";

    for (const file of routeFileIter(route)) {
      const fileInfo = addFile(file);
      fileInfo.routes.add(route);
      if (routeDefFiles) {
        routeDefFiles += ", ";
      }
      routeDefFiles += fileInfo.id;
    }

    writer.writeLines(
      `${JSON.stringify(route.path.path)}: [${routeDefFiles}];`,
    );
  }

  for (const special of Object.values(routes.special)) {
    addFile(special.page);
  }

  writer.writeBlockEnd(`}> {}`).writeBlockEnd(`}`);

  for (const fileType of Object.values(RoutableFileTypes)) {
    const fileGroup = fileInfoByType.get(fileType);
    if (!fileGroup) continue;

    const hasModule = fileType !== RoutableFileTypes.Meta;
    if (!hasModule) {
      writer.writeLines("");
    }

    for (const info of fileGroup.values()) {
      if (hasModule) {
        writer.writeLines("");
      }

      if (info.typeName && info.id) {
        writer.writeLines(
          `type ${info.id} = $.${info.typeName}<"${info.id}", typeof import("${info.modulePath}")>;`,
        );
      }

      if (!hasModule) continue;

      writer.write(`declare module "${info.modulePath}" {`);

      switch (fileType) {
        case RoutableFileTypes.Layout:
          writer.write(`
  interface Input extends $.LayoutInput<${info.id}> {}`);
          break;
        case RoutableFileTypes.Error:
          writer.write(`
  export interface Input {
    error: unknown;
  }`);
          break;
      }

      if (info.typeName) {
        const id = info.id || "any";
        writer.write(`
  const Run: $.Namespace<${id}>;
  namespace Run {
    type Context = $.ContextForFile<${id}>${info.typeName === "Template" ? " & Marko.Global" : ""};
  }\n`);
      }

      writer.write(`
  /** @deprecated use \`Run\` namespace instead */
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    /** @deprecated use the \`Run\` namespace instead */
    export type Route = ${
      info.routes.size
        ? `$.Routes[${[...info.routes]
            .map((route) => JSON.stringify(route.path.path))
            .join(" | ")}]`
        : "globalThis.MarkoRun.Route"
    };
    /** @deprecated use \`Run.Context\` instead */
    export type Context = ${
      info.modulePath.endsWith(".marko")
        ? "Run.Context"
        : "$.MultiRouteContext<Route>"
    };
    /** @deprecated define handlers with \`Run.GET(...)\`, \`Run.POST(...)\`, etc. instead */
    export type Handler = $.HandlerLike<Route>;`);
      for (const verb of httpVerbs) {
        writer.write(`
    /** @deprecated define handlers with \`Run.${verb.toUpperCase()}(...)\` instead */
    export type ${verb.toUpperCase()} = $.HandlerLike<Route, "${verb.toUpperCase()}">;`);
      }
      writer.write(`
  }`);

      writer.writeLines(`
}`);
    }
  }

  return writer.end();
}

function createRouteTrie(routes: Route[]): RouteTrie {
  const root: RouteTrie = {
    key: "",
  };

  function insert(path: PathInfo, route: Route) {
    let node = root;
    for (const segment of path.segments) {
      if (segment === "$$") {
        node.catchAll ??= { route, path };
        return;
      } else if (segment === "$") {
        node = node.dynamic ??= {
          key: "",
        };
      } else {
        node.static ??= new Map();
        let next = node.static.get(segment);
        if (!next) {
          next = {
            key: segment,
          };
          node.static.set(segment, next);
        }
        node = next;
      }
    }
    node.path ??= path;
    node.route ??= route;
  }

  for (const route of routes) {
    insert(route.path, route);
  }

  return root;
}

function normalizedRelativePath(from: string, to: string): string {
  const relativePath = normalizePath(path.relative(from, to));
  return relativePath.startsWith(".") ? relativePath : "./" + relativePath;
}

function writeEntryTemplateTag(
  writer: Writer,
  [file, ...rest]: string[],
  pageInputs: string[],
  index: number = 1,
): void {
  if (file) {
    const isLast = !rest.length;
    const tag = isLast ? "Page" : `Layout${index}`;

    writer.branch("imports").writeLines(`import ${tag} from "${file}";`);

    if (isLast) {
      const attributes = pageInputs.length
        ? " " + pageInputs.map((name) => `${name}=input.${name}`).join(" ")
        : "";
      writer.writeLines(`<${tag}${attributes}/>`);
    } else {
      writer.writeBlockStart(`<${tag}>`);
      writeEntryTemplateTag(writer, rest, pageInputs, index + 1);
      writer.writeBlockEnd(`</>`);
    }
  }
}

function writeRouteOptions(writer: Writer, route: Route, verb: HttpVerb): void {
  const hasHandler = route.handler?.verbs?.includes(verb);
  writer.write(`export const ${verb}${route.index}_options = `);

  if (route.middleware.length || hasHandler) {
    writer.write(`normalizeOptions('${verb.toUpperCase()}'`);

    for (const { id } of route.middleware) {
      writer.write(`, mware${id}`);
    }
    if (hasHandler) {
      writer.write(`, ${verb}Handler`);
    }
    writer.write(");");
  } else {
    writer.write("{};");
  }
  writer.write("\n");
}

function writeRouteEntryHandler(
  writer: Writer,
  route: Route,
  verb: HttpVerb,
  pageInput: string,
): void {
  const { key, index, page, handler, middleware } = route;
  const len = middleware.length;

  let nextName: string;
  let currentName: string;
  let hasBody = false;

  writer.writeLines("");

  writer.writeBlockStart(`export function ${verb}${index}(context) {`);

  const continuations = writer.branch("cont");

  if (
    page &&
    (verb === "get" || verb === "head" || verb === "post" || verb === "query")
  ) {
    currentName = "__page";
    if (handler?.verbs?.includes(verb)) {
      const name = `${verb}Handler`;

      continuations.writeLines(
        `const ${currentName} = (data) => render(context, page, ${pageInput}, data);`,
      );

      if (len) {
        nextName = currentName;
        currentName = `__${name}`;
        continuations.writeLines(
          `const ${currentName} = (data) => call(${name}, ${nextName}, context, data);`,
        );
      } else {
        if (verb === "head") {
          writer.writeLines(
            `return stripResponseBody(call(${name}, ${currentName}, context));`,
          );
        } else {
          writer.writeLines(`return call(${name}, ${currentName}, context);`);
        }
        hasBody = true;
      }
    } else if (verb === "head") {
      writer.writeLines(`return stripResponseBody(get${index}(context));`);
      hasBody = true;
    } else if (len) {
      continuations.writeLines(
        `const ${currentName} = (data) => render(context, page, ${pageInput}, data);`,
      );
    } else {
      writer.writeLines(`return render(context, page, ${pageInput});`);
      hasBody = true;
    }
  } else if (handler?.verbs?.includes(verb)) {
    const name = `${verb}Handler`;
    currentName = `__${name}`;
    nextName = "noContent";

    if (len) {
      continuations.writeLines(
        `const ${currentName} = (data) => call(${name}, ${nextName}, context, data);`,
      );
    } else {
      if (verb === "head") {
        writer.writeLines(
          `return stripResponseBody(call(${name}, ${nextName}, context));`,
        );
      } else {
        writer.writeLines(`return call(${name}, ${nextName}, context);`);
      }
      hasBody = true;
    }
  } else if (verb === "head" && route.handler?.verbs?.includes("get")) {
    writer.writeLines(`return stripResponseBody(get${index}(context));`);
    hasBody = true;
  } else {
    throw new Error(`Route ${key} has no handler for ${verb} requests`);
  }

  if (!hasBody) {
    let i = len;
    while (i--) {
      const { id } = middleware[i];
      const name = `mware${id}`;
      nextName = currentName!;
      currentName = i ? `__${name}` : "";
      if (currentName) {
        continuations.writeLines(
          `const ${currentName} = (data) => call(${name}, ${nextName}, context, data);`,
        );
      } else if (verb === "head") {
        continuations.writeLines(
          `return stripResponseBody(call(${name}, ${nextName}, context));`,
        );
      } else {
        continuations.writeLines(`return call(${name}, ${nextName}, context);`);
      }
    }
  }

  continuations.join();

  writer.writeBlockEnd("}");
}

function renderFetch(writer: Writer) {
  writer.write(`
export async function fetch(request, platform) {
  try {
    const url = new URL(request.url);
    const { pathname } = url;
    const route = match_internal(request.method, pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname);
    return await invoke(route, request, platform, url);
  } catch (error) {
    if (import.meta.env.DEV) {
      throw error;
    }
    return new Response(null, {
      status: 500
    });
  }
}`);
}

// The policy lives in `invoke` so every entry point — the generated `fetch`
// and the public `match`/`invoke` pair adapters compose — applies it.
function renderTrailingSlashPolicy(writer: Writer, options: RouterOptions) {
  if (!options.trailingSlashes || options.trailingSlashes === "Ignore") {
    return;
  }

  writer
    .writeBlockStart("if (route) {")
    .writeLines("url ??= new URL(request.url);", "const { pathname } = url;");

  switch (options.trailingSlashes) {
    case "RedirectWithout":
      writer
        .writeBlockStart("if (pathname.length > 1 && pathname.endsWith('/')) {")
        .writeLines(
          "url.pathname = pathname.slice(0, -1);",
          "return Response.redirect(url);",
        )
        .writeBlockEnd("}");
      break;
    case "RedirectWith":
      writer
        .writeBlockStart("if (!pathname.endsWith('/')) {")
        .writeLines("url.pathname += '/';", "return Response.redirect(url);")
        .writeBlockEnd("}");
      break;
    case "RewriteWithout":
      writer
        .writeBlockStart("if (pathname.length > 1 && pathname.endsWith('/')) {")
        .writeLines("url.pathname = pathname.slice(0, -1);")
        .writeBlockEnd("}");
      break;
    case "RewriteWith":
      writer
        .writeBlockStart("if (!pathname.endsWith('/')) {")
        .writeLines("url.pathname += '/';")
        .writeBlockEnd("}");
      break;
  }

  writer.writeBlockEnd("}");
}

// Anything outside RFC 3986's unreserved set (or stored %-escapes) may
// legitimately arrive percent-encoded, so it must be compared decoded.
const encodedOnWire = /[^\w.~-]/;
function needsDecode({ key }: RouteTrie) {
  const decoded = decodeURIComponent(key);
  return decoded !== key || encodedOnWire.test(decoded);
}

function writeRouterVerb(
  writer: Writer,
  trie: RouteTrie,
  verb: HttpVerb,
  level: number = 0,
  offset: number | string = 1,
): void {
  const { route, dynamic, catchAll } = trie;
  let closeCount = 0;

  if (level === 0) {
    if (route) {
      writer.writeLines(
        `if (len === 1) return ${renderMatch(verb, route, trie.path!)};`,
      );
    } else if (trie.static || dynamic) {
      writer.writeBlockStart(`if (len > 1) {`);
      closeCount++;
    }
  }

  if (trie.static || dynamic) {
    const next = level + 1;
    const index = `i${next}`;
    let terminal: RouteTrie[] | undefined;
    let children: RouteTrie[] | undefined;

    writer.writeLines(`const ${index} = pathname.indexOf('/', ${offset}) + 1;`);

    if (trie.static) {
      for (const child of trie.static.values()) {
        if (child.route) {
          (terminal ??= []).push(child);
        }
        if (child.static || child.dynamic || child.catchAll) {
          (children ??= []).push(child);
        }
      }
    }

    if (terminal || dynamic?.route) {
      closeCount++;
      writer.writeBlockStart(`if (!${index} || ${index} === len) {`);

      let value = `pathname.slice(${offset}, ${index} ? -1 : len)`;
      if (dynamic?.route) {
        const segment = `s${next}`;
        writer.writeLines(`const ${segment} = decodeURIComponent(${value});`);
        value = segment;
      } else if (terminal?.some(needsDecode)) {
        value = `decodeURIComponent(${value})`;
      }

      if (terminal) {
        const useSwitch = terminal.length > 1;

        if (useSwitch) {
          writer.writeBlockStart(`switch (${value}) {`);
        }

        for (const { key, path, route } of terminal) {
          const decodedKey = decodeURIComponent(key);
          if (useSwitch) {
            writer.write(`case ${JSON.stringify(decodedKey)}: `, true);
          } else {
            writer.write(
              `if (${value} === ${JSON.stringify(decodedKey)}) `,
              true,
            );
          }
          writer.write(`return ${renderMatch(verb, route!, path!)};\n`);
        }

        if (useSwitch) {
          writer.writeBlockEnd("}");
        }
      }

      if (dynamic?.route) {
        writer.writeLines(
          `if (${value}) return ${renderMatch(
            verb,
            dynamic.route,
            dynamic.path!,
          )};`,
        );
      }
    }

    if (children || dynamic?.static || dynamic?.dynamic || dynamic?.catchAll) {
      if (terminal || dynamic?.route) {
        writer.writeBlockEnd("} else {").indent++;
      } else {
        writer.writeBlockStart(`if (${index} && ${index} !== len) {`);
        closeCount++;
      }

      let value = `pathname.slice(${offset}, ${index} - 1)`;
      const decodeChildren = !!children?.some(needsDecode);
      if (dynamic?.static || dynamic?.dynamic || dynamic?.catchAll) {
        const segment = `s${next}`;
        writer.writeLines(`const ${segment} = decodeURIComponent(${value});`);
        value = segment;
      } else if (decodeChildren) {
        value = `decodeURIComponent(${value})`;
      }

      if (children) {
        const useSwitch = children.length > 1;

        if (useSwitch) {
          writer.writeBlockStart(`switch (${value}) {`);
        }

        for (const child of children) {
          const decodedKey = decodeURIComponent(child.key);
          if (useSwitch) {
            writer.writeBlockStart(`case ${JSON.stringify(decodedKey)}: {`);
          } else {
            writer.writeBlockStart(
              `if (${value} === ${JSON.stringify(decodedKey)}) {`,
            );
          }

          // A decoded comparison means the wire length can differ from the
          // key length, so the next segment starts at the runtime index.
          const nextOffset =
            typeof offset === "string" || decodeChildren
              ? index
              : offset + child.key.length + 1;
          writeRouterVerb(writer, child, verb, next, nextOffset);

          if (useSwitch) {
            writer.writeBlockEnd("} break;");
          } else {
            writer.writeBlockEnd("}");
          }
        }

        if (useSwitch) {
          writer.writeBlockEnd("}");
        }
      }

      if (dynamic?.static || dynamic?.dynamic || dynamic?.catchAll) {
        writer.writeBlockStart(`if (${value}) {`);
        writeRouterVerb(writer, dynamic, verb, next, index);
        writer.writeBlockEnd(`}`);
      }
    }
  }

  while (closeCount--) {
    writer.writeBlockEnd("}");
  }

  if (catchAll) {
    writer.writeLines(
      `return ${renderMatch(
        verb,
        catchAll.route,
        catchAll.path,
        String(offset),
      )};`,
    );
  } else if (level === 0) {
    writer.writeLines("return null;");
  }
}

function wrapPropertyName(name: string) {
  name = decodeURIComponent(name);
  return /^[^A-Za-z_$]|[^A-Za-z0-9$_]/.test(name) ? JSON.stringify(name) : name;
}

function renderParams(
  params: Record<string, number | null>,
  pathIndex?: string,
): string {
  let result = "";
  let catchAll = "";
  let sep = "{";

  for (const [name, index] of Object.entries(params)) {
    if (typeof index === "number") {
      result += `${sep} ${wrapPropertyName(name)}: s${index + 1}`;
      sep = ",";
    } else if (pathIndex) {
      catchAll = name;
    }
  }

  if (catchAll) {
    // Decoded like the `s${n}` vars behind dynamic segments, so both param
    // kinds agree and `Run.href`'s encode round-trips.
    result += `${sep} ${wrapPropertyName(
      catchAll,
    )}: decodeURIComponent(pathname.slice(${pathIndex}))`;
  }

  return result ? result + " }" : "{}";
}

function renderMatch(
  verb: HttpVerb,
  route: Route,
  path: PathInfo,
  pathIndex?: string,
) {
  const name = `${verb}${route.index}`;
  const params = path.params ? renderParams(path.params, pathIndex) : "{}";
  const meta = route.meta ? `${name}_meta` : "{}";
  return `{ handler: ${name}, path: ${JSON.stringify(path.path)}, params: ${params}, options: ${name}_options, meta: ${meta} }`;
}

function stripTsExtension(path: string) {
  const index = path.lastIndexOf(".");
  if (index !== -1) {
    const ext = path.slice(index + 1);
    if (ext.toLowerCase() === "ts") {
      return path.slice(0, index);
    }
  }
  return path;
}

function* routeFileIter(route: Route) {
  yield* route.middleware;
  if (route.handler) yield route.handler;
  yield* route.layouts;
  if (route.page) yield route.page;
  if (route.meta) yield route.meta;
}

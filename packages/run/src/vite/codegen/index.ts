import path from "path";

import {
  httpVerbs,
  markoRunFilePrefix,
  RoutableFileTypes,
  serverEntryQuery,
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
import { getVerbs, hasVerb } from "../utils/route";
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
  getRelativePath: (path: string) => string,
): string {
  if (!route.page) {
    throw new Error(`Route ${route.key} has no page to render`);
  }
  return renderEntryTemplate(
    route.entryName,
    [...route.layouts, route.page].map((file) =>
      getRelativePath(file.importPath),
    ),
    route.key === RoutableFileTypes.Error ? ["error"] : [],
  );
}

export function renderEntryTemplate(
  name: string,
  files: string[],
  pageInputs: string[] = [],
): string {
  if (!name) {
    throw new Error(`Invalid argument - 'name' cannot be empty`);
  }
  if (!files.length) {
    throw new Error(`Invalid argument - 'files' cannot be empty`);
  }

  const writer = createStringWriter();
  writer.writeLines(`// ${name}.marko`);
  writer.branch("imports");
  writer.writeLines("");
  writeEntryTemplateTag(writer, files, pageInputs);

  return writer.end();
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

    writer.branch("imports").writeLines(`import ${tag} from '${file}';`);

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

export function renderRouteEntry(route: Route, entriesDir: string): string {
  const { key, index, handler, page, middleware, meta, entryName } = route;
  const verbs = getVerbs(route);

  if (!verbs) {
    throw new Error(
      `Route ${key} doesn't have a handler or page for any HTTP verbs`,
    );
  }

  const writer = createStringWriter();

  writer.writeLines(`// ${virtualFilePrefix}/${entryName}.js`);

  const imports = writer.branch("imports");

  const runtimeImports = [];

  if (handler) {
    runtimeImports.push("normalize");
  }
  if (handler || middleware.length) {
    runtimeImports.push("call");
  }
  if (!page || verbs.length > 1) {
    runtimeImports.push("noContent");
  }
  if (page) {
    runtimeImports.push("pageResponse");
  }

  if (runtimeImports.length) {
    imports.writeLines(
      `import { ${runtimeImports.join(
        ", ",
      )} } from '${virtualFilePrefix}/runtime/internal';`,
    );
  }

  if (middleware.length) {
    const names = middleware.map((m) => `mware${m.id}`);
    imports.writeLines(
      `import { ${names.join(
        ", ",
      )} } from '${virtualFilePrefix}/${markoRunFilePrefix}middleware.js';`,
    );
  }

  if (handler?.verbs?.length) {
    writer.writeLines("");

    const names: string[] = [];
    for (const verb of handler.verbs) {
      const importName = verb.toUpperCase();
      names.push(importName);
      writer.writeLines(`const ${verb}Handler = normalize(${importName});`);
    }
    imports.writeLines(
      `import { ${names.join(", ")} } from './${handler.importPath}';`,
    );
  }
  if (page) {
    const pageNameIndex = page.name.indexOf("+page");
    const pageNamePrefix =
      pageNameIndex > 0 ? `${page.name.slice(0, pageNameIndex)}.` : "";

    const importPath = route.layouts.length
      ? `./${path.posix.join(entriesDir, page.relativePath, "..", pageNamePrefix + "route.marko")}`
      : `./${page.importPath}`;
    imports.writeLines(`import page from '${importPath}${serverEntryQuery}';`);
  }
  if (meta) {
    imports.writeLines(
      `export { default as meta${index} } from './${meta.importPath}';`,
    );
  }

  for (const verb of verbs) {
    writeRouteEntryHandler(writer, route, verb);
  }

  return writer.end();
}

function writePageResponse(writer: Writer, wrapFn?: string): void {
  writer.writeLines(
    `${
      wrapFn ? `const ${wrapFn} = () =>` : `return`
    } pageResponse(page, buildInput());`,
  );
}

function writeMiddleware(
  writer: Writer,
  middleware: string,
  next: string,
  wrapFn?: string,
): void {
  if (wrapFn) {
    writer.writeLines(
      `const ${wrapFn} = () => call(${middleware}, ${next}, context);`,
    );
  } else {
    writer.writeLines(`return call(${middleware}, ${next}, context);`);
  }
}

function writeRouteEntryHandler(
  writer: Writer,
  route: Route,
  verb: HttpVerb,
): void {
  const { key, index, page, handler, middleware } = route;
  const len = middleware.length;

  let nextName: string;
  let currentName: string;
  let hasBody = false;

  writer.writeLines("");

  if (page) {
    writer.writeBlockStart(
      `export async function ${verb}${index}(context, buildInput) {`,
    );
  } else {
    writer.writeBlockStart(`export async function ${verb}${index}(context) {`);
  }

  const continuations = writer.branch("cont");

  if (page && verb === "get") {
    currentName = "__page";
    if (handler?.verbs?.includes(verb)) {
      const name = `${verb}Handler`;

      writePageResponse(continuations, currentName);

      if (len) {
        nextName = currentName;
        currentName = `__${name}`;
        writeMiddleware(continuations, name, nextName, currentName);
      } else {
        writeMiddleware(writer, name, currentName);
        hasBody = true;
      }
    } else if (len) {
      writePageResponse(continuations, currentName);
      nextName = currentName;
    } else {
      writePageResponse(continuations);
      hasBody = true;
    }
  } else if (handler) {
    const name = `${verb}Handler`;
    currentName = `__${name}`;
    nextName = "noContent";

    if (len) {
      writeMiddleware(continuations, name, nextName, currentName);
    } else {
      writeMiddleware(writer, name, nextName);
      hasBody = true;
    }
  } else {
    throw new Error(`Route ${key} has no handler for ${verb} requests`);
  }

  if (!hasBody) {
    let i = len;
    while (i--) {
      const { id } = middleware[i];
      const name = `mware${id}`;
      nextName = currentName;
      currentName = i ? `__${name}` : "";
      writeMiddleware(continuations, name, nextName, currentName);
    }
  }

  continuations.join();

  writer.writeBlockEnd("}");
}

export function renderRouter(
  routes: BuiltRoutes,
  entriesDir: string,
  options: RouterOptions = {
    trailingSlashes: "RedirectWithout",
  },
): string {
  const writer = createStringWriter();

  writer.writeLines(`// @marko/run/router`);

  const imports = writer.branch("imports");

  imports.writeLines(
    `import { NotHandled, NotMatched, createContext } from '${virtualFilePrefix}/runtime/internal';`,
  );

  for (const route of routes.list) {
    const verbs = getVerbs(route);
    const names = verbs.map((verb) => `${verb}${route.index}`);
    route.meta && names.push(`meta${route.index}`);

    imports.writeLines(
      `import { ${names.join(", ")} } from '${virtualFilePrefix}/${
        route.entryName
      }.js';`,
    );
  }
  for (const route of Object.values(routes.special) as Route[]) {
    const importPath = route.layouts.length
      ? `./${path.posix.join(entriesDir, route.page!.relativePath, "..", `route.${route.key}.marko`)}`
      : `./${route.page!.importPath}`;
    imports.writeLines(
      `import page${route.key} from '${importPath}${serverEntryQuery}';`,
    );
  }

  writer
    .writeLines(
      `
globalThis.__marko_run__ = { match, fetch, invoke };
    `,
    )
    .writeBlockStart(`export function match(method, pathname) {`)
    .writeLines(
      `if (!pathname) {
    pathname = '/';
  } else if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname;
  }`,
    )
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

  writer.writeBlockEnd("}").writeLines("return null;").writeBlockEnd("}");

  writer
    .writeLines("")
    .writeBlockStart(
      "export async function invoke(route, request, platform, url) {",
    )
    .writeLines(
      "const [context, buildInput] = createContext(route, request, platform, url);",
    );

  const hasErrorPage = Boolean(routes.special[RoutableFileTypes.Error]);

  if (hasErrorPage) {
    writer.writeBlockStart("try {");
  }

  writer
    .writeBlockStart("if (route) {")
    .writeBlockStart("try {")
    .writeLines(
      "const response = await route.handler(context, buildInput);",
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

  if (routes.special[RoutableFileTypes.NotFound]) {
    imports.writeLines(
      `
const page404ResponseInit = {
  status: 404,
  headers: { "content-type": "text/html;charset=UTF-8" },
};`,
    );

    writer.write(`    
    if (context.request.headers.get('Accept')?.includes('text/html')) {
      return new Response(page404.stream(buildInput()), page404ResponseInit);
    }
`);
  }

  writer.indent--;

  if (hasErrorPage) {
    imports.writeLines(`
const page500ResponseInit = {
  status: 500,
  headers: { "content-type": "text/html;charset=UTF-8" },
};`);

    writer
      .writeBlockStart(`} catch (error) {`)
      .writeBlockStart(
        `if (context.request.headers.get('Accept')?.includes('text/html')) {`,
      )
      .writeLines(
        `return new Response(page500.stream(buildInput({ error })), page500ResponseInit);`,
      )
      .writeBlockEnd("}")
      .writeLines("throw error;")
      .writeBlockEnd("}");
  }

  writer.writeBlockEnd("}");

  renderFetch(writer, options);

  return writer.end();
}

function renderFetch(writer: Writer, options: RouterOptions) {
  writer.write(`
export async function fetch(request, platform) {
  try {
    const url = new URL(request.url);
    let { pathname } = url;`);

  switch (options.trailingSlashes) {
    case "RedirectWithout":
      writer.write(`
    if (pathname !== '/' && pathname.endsWith('/')) {
      url.pathname = pathname.slice(0, -1);
      return Response.redirect(url);
    }`);
      break;
    case "RedirectWith":
      writer.write(`
    if (pathname !== '/' && !pathname.endsWith('/')) {
      url.pathname = pathname + '/';
      return Response.redirect(url);
    }`);
      break;
    case "RewriteWithout":
      writer.write(`
    if (pathname !== '/' && pathname.endsWith('/')) {
      url.pathname = pathname = pathname.slice(0, -1);
    }`);
      break;
    case "RewriteWith":
      writer.write(`
    if (pathname !== '/' && !pathname.endsWith('/')) {
      url.pathname = pathname = pathname + '/';
    }`);
      break;
  }

  writer.write(`   

    const route = match(request.method, pathname);
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
    writer.writeLines(`const len = pathname.length;`);
    if (route) {
      writer.writeLines(
        `if (len === 1) return ${renderMatch(verb, route, trie.path!)}; // ${
          trie.path!.path
        }`,
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
      } else if (
        terminal?.some(
          (terminal) => decodeURIComponent(terminal.key) !== terminal.key,
        )
      ) {
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
            writer.write(`case '${decodedKey}': `, true);
          } else {
            writer.write(`if (${value} === '${decodedKey}') `, true);
          }
          writer.write(
            `return ${renderMatch(verb, route!, path!)}; // ${path!.path}\n`,
          );
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
          )}; // ${dynamic.path!.path}`,
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
      if (dynamic?.static || dynamic?.dynamic || dynamic?.catchAll) {
        const segment = `s${next}`;
        writer.writeLines(`const ${segment} = decodeURIComponent(${value});`);
        value = segment;
      } else if (
        children?.some((child) => decodeURIComponent(child.key) !== child.key)
      ) {
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
            writer.writeBlockStart(`case '${decodedKey}': {`);
          } else {
            writer.writeBlockStart(`if (${value} === '${decodedKey}') {`);
          }

          const nextOffset =
            typeof offset === "string" ? index : offset + child.key.length + 1;
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
      )}; // ${catchAll.path.path}`,
    );
  } else if (level === 0) {
    writer.writeLines("return null;");
  }
}

function wrapPropertyName(name: string) {
  name = decodeURIComponent(name);
  return /^[^A-Za-z_$]|[^A-Za-z0-9$_]/.test(name) ? `'${name}'` : name;
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
    result += `${sep} ${wrapPropertyName(
      catchAll,
    )}: pathname.slice(${pathIndex})`;
  }

  return result ? result + " }" : "{}";
}

function renderMatch(
  verb: HttpVerb,
  route: Route,
  path: PathInfo,
  pathIndex?: string,
) {
  const handler = `${verb}${route.index}`;
  const params = path.params ? renderParams(path.params, pathIndex) : "{}";
  const meta = route.meta ? `meta${route.index}` : "{}";
  const pathPattern = pathToURLPatternString(path.path);
  return `{ handler: ${handler}, params: ${params}, meta: ${meta}, path: '${pathPattern}' }`;
}

export function renderMiddleware(middleware: RoutableFile[]): string {
  const writer = createStringWriter();
  writer.writeLines(
    `// ${virtualFilePrefix}/${markoRunFilePrefix}middleware.js`,
  );

  const imports = writer.branch("imports");
  imports.writeLines(
    `import { normalize } from '${virtualFilePrefix}/runtime/internal';`,
  );

  writer.writeLines("");

  for (const { id, importPath } of middleware) {
    const importName = `middleware${id}`;
    imports.writeLines(`import ${importName} from './${importPath}';`);
    writer.writeLines(`export const mware${id} = normalize(${importName});`);
  }

  imports.join();
  return writer.end();
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

export async function renderRouteTypeInfo(
  routes: BuiltRoutes,
  pathPrefix: string = ".",
  adapter?: Adapter | null,
) {
  const writer = createStringWriter();
  writer.writeLines(
    `/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/
`,
    `import { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform } from "@marko/run/namespace";`,
    `import type * as Run from "@marko/run";`,
  );

  const headWriter = writer.branch("head");

  writer.writeLines("\n").writeBlockStart(`declare module "@marko/run" {`);

  if (adapter && adapter.typeInfo) {
    const platformType = await adapter.typeInfo((data) =>
      headWriter.write(data),
    );
    if (platformType) {
      writer.writeLines(`interface Platform extends ${platformType} {}\n`);
    }
  }

  headWriter.join();

  writer
    .writeBlockStart(`interface AppData extends Run.DefineApp<{`)
    .writeBlockStart("routes: {");

  const routesWriter = writer.branch("routes");

  writer.writeBlockEnd("}").writeBlockEnd(`}> {}`).writeBlockEnd(`}`);

  const routeTypes = new Map<RoutableFile, string[]>();

  for (const route of routes.list) {
    let routeType = "";

    for (const path of route.paths) {
      const pathType = `"${pathToURLPatternString(path.path)}"`;
      routeType += routeType ? " | " + pathType : pathType;
      routesWriter.writeLines(`${pathType}: Routes["${route.key}"];`);
    }

    for (const file of [route.handler, route.page]) {
      if (file) {
        const existing = routeTypes.get(file);
        if (!existing) {
          routeTypes.set(file, [routeType]);
        } else {
          existing.push(routeType);
        }
      }
    }

    for (const files of [route.middleware, route.layouts]) {
      if (files) {
        for (const file of files) {
          const existing = routeTypes.get(file);
          if (!existing) {
            routeTypes.set(file, [routeType]);
          } else {
            existing.push(routeType);
          }
        }
      }
    }
  }

  for (const special of Object.values(routes.special)) {
    routeTypes.set(special.page, []);
  }

  routesWriter.join();

  const handlerWriter = writer.branch("handler");
  const middlewareWriter = writer.branch("middleware");
  const pageWriter = writer.branch("page");
  const layoutWriter = writer.branch("layout");

  for (const [file, types] of routeTypes) {
    const path = `${pathPrefix}/${file.relativePath}`;
    const routeType = `Run.Routes[${types.join(" | ")}]`;

    switch (file.type) {
      case RoutableFileTypes.Handler:
        writeModuleDeclaration(handlerWriter, path, routeType);
        break;
      case RoutableFileTypes.Middleware:
        writeModuleDeclaration(middlewareWriter, path, routeType);
        break;
      case RoutableFileTypes.Page:
        writeModuleDeclaration(pageWriter, path, routeType);
        break;
      case RoutableFileTypes.Layout:
        writeModuleDeclaration(
          layoutWriter,
          path,
          routeType,
          `
  export interface Input {
    renderBody: Marko.Body;
  }`,
        );
        break;
      case RoutableFileTypes.Error:
        writeModuleDeclaration(
          writer,
          path,
          "globalThis.MarkoRun.Route",
          `
  export interface Input {
    error: unknown;
  }`,
        );
        break;
      case RoutableFileTypes.NotFound:
        writeModuleDeclaration(writer, path, "Run.Route");
        break;
    }
  }

  handlerWriter.join();
  middlewareWriter.join();
  pageWriter.join();
  layoutWriter.join();

  writer.writeBlockStart(`\ntype Routes = {`);

  for (const route of routes.list) {
    const { meta, handler, page } = route;

    if (page || handler) {
      const verbs = [];
      if (page || handler?.verbs?.includes("get")) {
        verbs.push(`"get"`);
      }
      if (handler?.verbs?.includes("post")) {
        verbs.push(`"post"`);
      }

      let routeType = `{ verb: ${verbs.join(" | ")};`;

      if (meta) {
        const metaPath = stripTsExtension(`${pathPrefix}/${meta.relativePath}`);
        let metaType = `typeof import("${metaPath}")`;
        if (/\.(ts|js|mjs)$/.test(meta.name)) {
          metaType += `["default"]`;
        }
        routeType += ` meta: ${metaType};`;
      }

      writer.writeLines(`"${route.key}": ${routeType} };`);
    }
  }

  writer.writeBlockEnd("}");

  return writer.end();
}

function writeModuleDeclaration(
  writer: Writer,
  path: string,
  routeType?: string,
  moduleTypes?: string,
) {
  writer.writeLines("").write(`declare module "${stripTsExtension(path)}" {`);

  if (moduleTypes) {
    writer.write(moduleTypes);
  }

  if (routeType) {
    const isMarko = path.endsWith(".marko");
    writer.write(`
  namespace MarkoRun {
    export { NotHandled, NotMatched, GetPaths, PostPaths, GetablePath, GetableHref, PostablePath, PostableHref, Platform };
    export type Route = ${routeType};
    export type Context = Run.MultiRouteContext<Route>${
      isMarko ? " & Marko.Global" : ""
    };
    export type Handler = Run.HandlerLike<Route>;
    /** @deprecated use \`((context, next) => { ... }) satisfies MarkoRun.Handler\` instead */
    export const route: Run.HandlerTypeFn<Route>;
  }`);
  }

  writer.writeLines(`
}`);
}

function pathToURLPatternString(path: string): string {
  return path.replace(/\/\$(\$?)([^/]*)/g, (_, catchAll, name) => {
    name = decodeURIComponent(name);
    return catchAll ? `/:${name || "rest"}*` : `/:${name}`;
  });
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
    for (const path of route.paths) {
      insert(path, route);
    }
  }

  return root;
}

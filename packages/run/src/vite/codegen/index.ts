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

function normalizedRelativePath(from: string, to: string): string {
  const relativePath = normalizePath(path.relative(from, to));
  return relativePath.startsWith(".") ? relativePath : "./" + relativePath;
}

export function renderRouteTemplate(route: Route, rootDir: string): string {
  if (!route.page) {
    throw new Error(`Route ${route.key} has no page to render`);
  }
  if (!route.templateFilePath) {
    throw new Error(`Route ${route.key} has no template file path`);
  }

  return renderEntryTemplate(
    normalizedRelativePath(rootDir, route.templateFilePath),
    [...route.layouts, route.page].map((file) =>
      normalizedRelativePath(
        path.dirname(route.templateFilePath!),
        file.filePath,
      ),
    ),
    route.key === RoutableFileTypes.Error ? ["error"] : [],
  );
}

function renderEntryTemplate(
  name: string,
  files: string[],
  pageInputs: string[] = [],
): string {
  if (!files.length) {
    throw new Error(`Invalid argument - 'files' cannot be empty`);
  }

  const writer = createStringWriter();
  writer.writeLines(`// ${name}`);
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

export function renderRouteEntry(route: Route, rootDir: string): string {
  const { key, index, handler, page, middleware, meta } = route;
  const verbs = getVerbs(route);

  if (!verbs) {
    throw new Error(
      `Route ${key} doesn't have a handler or page for any HTTP verbs`,
    );
  }

  const writer = createStringWriter();

  writer.writeLines(`// ${virtualFilePrefix}${getRouteVirtualFileName(route)}`);

  const imports = writer.branch("imports");
  const runtimeImports = [];

  if (handler) {
    runtimeImports.push("normalize");
  }
  if (handler || middleware.length) {
    runtimeImports.push("call");
  }
  if (!page || verbs.some((verb) => verb !== "get" && verb !== "head")) {
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
      writer.writeLines(`const ${verb}Handler = normalize(${importName});`);
    }
    imports.writeLines(
      `import { ${names.join(", ")} } from "${normalizedRelativePath(rootDir, handler.filePath)}";`,
    );
  }

  if (page) {
    imports.writeLines(
      `import page from "${normalizedRelativePath(rootDir, route.templateFilePath || page.filePath)}${serverEntryQuery}";`,
    );
  }
  if (meta) {
    imports.writeLines(
      `export { default as meta${index} } from "${normalizedRelativePath(rootDir, meta.filePath)}";`,
    );
  }

  for (const verb of verbs) {
    writeRouteEntryHandler(writer, route, verb);
  }

  return writer.end();
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

  if (page && (verb === "get" || verb === "head")) {
    writer.writeBlockStart(`export function ${verb}${index}(context) {`);
  } else {
    writer.writeBlockStart(`export function ${verb}${index}(context) {`);
  }

  const continuations = writer.branch("cont");

  if (page && (verb === "get" || verb === "head")) {
    currentName = "__page";
    if (handler?.verbs?.includes(verb)) {
      const name = `${verb}Handler`;

      continuations.writeLines(
        `const ${currentName} = () => context.render(page, {});`,
      );

      if (len) {
        nextName = currentName;
        currentName = `__${name}`;
        continuations.writeLines(
          `const ${currentName} = () => call(${name}, ${nextName}, context);`,
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
        `const ${currentName} = () => context.render(page, {});`,
      );
      nextName = currentName;
    } else {
      writer.writeLines(`return context.render(page, {});`);
      hasBody = true;
    }
  } else if (handler?.verbs?.includes(verb)) {
    const name = `${verb}Handler`;
    currentName = `__${name}`;
    nextName = "noContent";

    if (len) {
      continuations.writeLines(
        `const ${currentName} = () => call(${name}, ${nextName}, context);`,
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
          `const ${currentName} = () => call(${name}, ${nextName}, context);`,
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

export function renderRouter(
  routes: BuiltRoutes,
  rootDir: string,
  runtimeInclude: string | undefined,
  options: RouterOptions = {
    trailingSlashes: "RedirectWithout",
  },
): string {
  const writer = createStringWriter();

  const hasErrorPage = Boolean(routes.special[RoutableFileTypes.Error]);
  const hasNotFoundPage = Boolean(routes.special[RoutableFileTypes.NotFound]);

  writer.writeLines(`// @marko/run/router`);

  const imports = writer.branch("imports");

  if (runtimeInclude) {
    imports.writeLines(`import "${normalizePath(runtimeInclude)}";`);
  }

  imports.writeLines(
    `import { NotHandled, NotMatched, createContext } from "${virtualFilePrefix}/runtime/internal";`,
  );

  for (const route of routes.list) {
    const verbs = getVerbs(route);
    const names = verbs.map((verb) => `${verb}${route.index}`);
    route.meta && names.push(`meta${route.index}`);

    imports.writeLines(
      `import { ${names.join(", ")} } from "${virtualFilePrefix}/${getRouteVirtualFileName(route)}";`,
    );
  }
  for (const route of Object.values(routes.special) as Route[]) {
    imports.writeLines(
      `import page${route.key} from "${normalizedRelativePath(rootDir, route.templateFilePath || route.page!.filePath)}${serverEntryQuery}";`,
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
      `const last = pathname.length - 1;
  return match_internal(method, last && pathname.charAt(last) === '/' ? pathname.slice(0, last) : pathname)
};
  
function match_internal(method, pathname) {
  const len = pathname.length;`,
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
    imports.writeLines(
      `
const page404ResponseInit = {
  status: 404,
  headers: { "content-type": "text/html;charset=UTF-8" },
};`,
    );

    writer.write(`    
    if (context.request.headers.get('Accept')?.includes('text/html')) {
      return context.render(page404, {}, page404ResponseInit);
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
        `return context.render(page500, { error }, page500ResponseInit);`,
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
    const { pathname } = url;
    const last = pathname.length - 1;
    const hasTrailingSlash = last && pathname.charAt(last) === '/';
    const normalizedPathname = hasTrailingSlash ? pathname.slice(0, last) : pathname;
    const route = match_internal(request.method, normalizedPathname);`);

  switch (options.trailingSlashes) {
    case "RedirectWithout":
      writer.write(`
    if (route && hasTrailingSlash) {
      url.pathname = normalizedPathname
      return Response.redirect(url);
    }`);
      break;
    case "RedirectWith":
      writer.write(`
    if (route && pathname !== '/' && !hasTrailingSlash) {
      url.pathname += '/';
      return Response.redirect(url);
    }`);
      break;
    case "RewriteWithout":
      writer.write(`
    if (route && hasTrailingSlash) {
      url.pathname = normalizedPathname;
    }`);
      break;
    case "RewriteWith":
      writer.write(`
    if (route && pathname !== '/' && !hasTrailingSlash) {
      url.pathname += '/';
    }`);
      break;
  }

  writer.write(`   
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
      )};`,
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
  return `{ handler: ${handler}, params: ${params}, meta: ${meta}, path: '${path.path}' }`;
}

export function renderMiddleware(
  middleware: RoutableFile[],
  rootDir: string,
): string {
  const writer = createStringWriter();
  writer.writeLines(
    `// ${virtualFilePrefix}/${markoRunFilePrefix}middleware.js`,
  );

  const imports = writer.branch("imports");
  imports.writeLines(
    `import { normalize } from "${virtualFilePrefix}/runtime/internal";`,
  );

  writer.writeLines("");

  for (const { id, filePath } of middleware) {
    const importName = `middleware${id}`;
    imports.writeLines(
      `import ${importName} from "${normalizedRelativePath(rootDir, filePath)}";`,
    );
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

function decodePath(path: string) {
  return path; //decodeURIComponent(path.replace(/%2F/g, "%252f"));
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
    let routeDefinition = "";

    if (route.page || route.handler) {
      const verbs = [];
      if (route.page || route.handler?.verbs?.includes("get")) {
        verbs.push(`"get"`);
      }
      if (route.handler?.verbs?.includes("post")) {
        verbs.push(`"post"`);
      }

      routeDefinition = `{ verb: ${verbs.join(" | ")};`;

      if (route.meta) {
        const metaPath = stripTsExtension(
          normalizedRelativePath(outDir, route.meta.filePath),
        );
        let metaType = `typeof import("${metaPath}")`;
        if (/\.(ts|js|mjs)$/.test(route.meta.name)) {
          metaType += `["default"]`;
        }
        routeDefinition += ` meta: ${metaType};`;
      }

      routeDefinition += " }";
    }

    const pathType = `"${decodePath(route.path.path)}"`;
    routeType += routeType ? " | " + pathType : pathType;
    routesWriter.writeLines(`${pathType}: ${routeDefinition};`);

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
    const modulePath = stripTsExtension(
      normalizedRelativePath(outDir, file.filePath),
    );
    const routeType = `Run.Routes[${types.join(" | ")}]`;

    switch (file.type) {
      case RoutableFileTypes.Handler:
        writeModuleDeclaration(handlerWriter, modulePath, routeType);
        break;
      case RoutableFileTypes.Middleware:
        writeModuleDeclaration(middlewareWriter, modulePath, routeType);
        break;
      case RoutableFileTypes.Page:
        writeModuleDeclaration(pageWriter, modulePath, routeType);
        break;
      case RoutableFileTypes.Layout:
        writeModuleDeclaration(
          layoutWriter,
          modulePath,
          routeType,
          `
  export interface Input extends Run.LayoutInput<typeof import("${modulePath}")> {}`,
        );
        break;
      case RoutableFileTypes.Error:
        writeModuleDeclaration(
          writer,
          modulePath,
          "globalThis.MarkoRun.Route",
          `
  export interface Input {
    error: unknown;
  }`,
        );
        break;
      case RoutableFileTypes.NotFound:
        writeModuleDeclaration(writer, modulePath, "Run.Route");
        break;
    }
  }

  handlerWriter.join();
  middlewareWriter.join();
  pageWriter.join();
  layoutWriter.join();

  return writer.end();
}

function writeModuleDeclaration(
  writer: Writer,
  name: string,
  routeType?: string,
  moduleTypes?: string,
) {
  writer.writeLines("").write(`declare module "${name}" {`);

  if (moduleTypes) {
    writer.write(moduleTypes);
  }

  if (routeType) {
    const isMarko = name.endsWith(".marko");
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

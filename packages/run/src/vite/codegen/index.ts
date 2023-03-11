import {
  httpVerbs,
  RoutableFileTypes,
  serverEntryQuery,
  virtualFilePrefix,
  markoRunFilePrefix,
  virtualRuntimePrefix,
} from "../constants";
import { createStringWriter } from "./writer";
import { createRouteTrie } from "../routes/routeTrie";
import type {
  Adapter,
  HttpVerb,
  Route,
  BuiltRoutes,
  RouteTrie,
  ParamInfo,
  RoutableFile,
  RouterOptions,
} from "../types";
import type { Writer } from "./writer";
import { getVerbs, hasVerb } from "../utils/route";

export function renderRouteTemplate(route: Route): string {
  if (!route.page) {
    throw new Error(`Route ${route.key} has no page to render`);
  }

  const writer = createStringWriter();
  writer.writeLines(
    `// ${virtualFilePrefix}/${markoRunFilePrefix}route__${route.key}.marko`
  );
  writer.branch("imports");
  writer.writeLines("");
  writeRouteTemplateTag(writer, [...route.layouts, route.page]);

  return writer.end();
}

function writeRouteTemplateTag(
  writer: Writer,
  [file, ...rest]: RoutableFile[],
  index: number = 1
): void {
  if (file) {
    const isLast = !rest.length;
    const tag = isLast ? "page" : `layout${index}`;

    writer
      .branch("imports")
      .writeLines(`import ${tag} from './${file.importPath}';`);

    if (isLast) {
      writer.writeLines(`<${tag} ...input />`);
    } else {
      writer.writeBlockStart(`<${tag} ...input>`);
      writeRouteTemplateTag(writer, rest, index + 1);
      writer.writeBlockEnd(`</>`);
    }
  }
}

export function renderRouteEntry(route: Route): string {
  const { key, index, handler, page, middleware, meta } = route;
  const verbs = getVerbs(route);

  if (!verbs) {
    throw new Error(
      `Route ${key} doesn't have a handler or page for any HTTP verbs`
    );
  }

  const writer = createStringWriter();

  writer.writeLines(
    `// ${virtualFilePrefix}/${markoRunFilePrefix}route__${key}.js`
  );

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
      `import { ${runtimeImports.join(", ")} } from '${virtualRuntimePrefix}';`
    );
  }

  if (middleware.length) {
    const names = middleware.map((m) => `mware${m.id}`);
    imports.writeLines(
      `import { ${names.join(
        ", "
      )} } from '${virtualFilePrefix}/${markoRunFilePrefix}middleware.js';`
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
      `import { ${names.join(", ")} } from './${handler.importPath}';`
    );
  }
  if (page) {
    imports.writeLines(
      `import page from '${virtualFilePrefix}/${markoRunFilePrefix}route__${key}.marko${serverEntryQuery}';`
    );
  }
  if (meta) {
    imports.writeLines(
      `export { default as meta${index} } from './${meta.importPath}';`
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
    } pageResponse(page, buildInput());`
  );
}

function writeMiddleware(
  writer: Writer,
  middleware: string,
  next: string,
  wrapFn?: string
): void {
  if (wrapFn) {
    writer.writeLines(
      `const ${wrapFn} = () => call(${middleware}, ${next}, context);`
    );
  } else {
    writer.writeLines(`return call(${middleware}, ${next}, context);`);
  }
}

function writeRouteEntryHandler(
  writer: Writer,
  route: Route,
  verb: HttpVerb
): void {
  const { key, index, page, handler, middleware } = route;
  const len = middleware.length;

  let nextName: string;
  let currentName: string;
  let hasBody = false;

  writer.writeLines("");

  if (page) {
    writer.writeBlockStart(
      `export async function ${verb}${index}(context, buildInput) {`
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
  options: RouterOptions = {
    trailingSlashes: "RedirectWithout",
  }
): string {
  const writer = createStringWriter();

  writer.writeLines(`// @marko/run/router`);

  const imports = writer.branch("imports");

  imports.writeLines(
    `import { NotHandled, NotMatched, createContext } from 'virtual:marko-run/internal';`
  );

  for (const route of routes.list) {
    const verbs = getVerbs(route);
    const names = verbs.map((verb) => `${verb}${route.index}`);
    route.meta && names.push(`meta${route.index}`);

    imports.writeLines(
      `import { ${names.join(
        ", "
      )} } from '${virtualFilePrefix}/${markoRunFilePrefix}route__${
        route.key
      }.js';`
    );
  }
  for (const { key } of Object.values(routes.special)) {
    imports.writeLines(
      `import page${key} from '${virtualFilePrefix}/${markoRunFilePrefix}special__${key}.marko${serverEntryQuery}';`
    );
  }

  writer
    .writeLines(
      `
const page404ResponseInit = {
  status: 404,
  headers: { "content-type": "text/html;charset=UTF-8" },
};
const page500ResponseInit = {
  status: 404,
  headers: { "content-type": "text/html;charset=UTF-8" },
};`
    )
    .writeBlockStart(`export function match(method, pathname) {`)
    .writeLines(
      `if (!pathname) {
    pathname = '/';
  } else if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname;
  }`
    )
    .writeBlockStart(`switch (method.toLowerCase()) {`);

  for (const verb of httpVerbs) {
    const filteredRoutes = routes.list.filter((route) => hasVerb(route, verb));
    if (filteredRoutes.length) {
      const trie = createRouteTrie(filteredRoutes);
      writer.writeBlockStart(`case '${verb}': {`);
      writeRouterVerb(writer, trie, verb);
      writer.writeBlockEnd("}");
    }
  }

  writer.writeBlockEnd("}").writeLines("return null;").writeBlockEnd("}");

  writer.write(`
export async function invoke(route, request, platform, url) {
  const [context, buildInput] = createContext(route, request, platform, url);
	try {
		if (route) {
      try {
				const response = await route.handler(context, buildInput);
				if (response) return response;
			} catch (error) {
				if (error === NotHandled) {
					return;
				} else if (error !== NotMatched) {
					throw error;
				}
			}
`).indent = 2;

  if (routes.special[RoutableFileTypes.NotFound]) {
    writer.write(
      `    } else {
    }
    if (context.request.headers.get('Accept')?.includes('text/html')) {
      return new Response(page404.stream(buildInput()), page404ResponseInit);
    }
`
    );
  } else {
    writer.writeBlockEnd("}");
  }

  writer.indent--;
  writer.writeBlockStart(`} catch (error) {`);

  if (routes.special[RoutableFileTypes.Error]) {
    writer
      .writeBlockStart(
        `if (context.request.headers.get('Accept')?.includes('text/html')) {`
      )
      .writeLines(
        `return new Response(page500.stream(buildInput({ error })), page500ResponseInit);`
      )
      .writeBlockEnd("}");
  }

  writer.writeLines(`throw error;`).writeBlockEnd("}").writeBlockEnd("}")
    .write(`
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
    const body = import.meta.env.DEV
      ? error.stack || error.message || "Internal Server Error"
      : null;
    return new Response(body, {
      status: 500
    });
  }
}`);

  return writer.end();
}

function writeRouterVerb(
  writer: Writer,
  trie: RouteTrie,
  verb: HttpVerb,
  level: number = 0,
  offset: number | string = 1
): void {
  const { route, dynamic, catchAll } = trie;
  let closeCount = 0;

  if (level === 0) {
    writer.writeLines(`const len = pathname.length;`);
    if (route) {
      writer.writeLines(
        `if (len === 1) return ${renderMatch(verb, route)}; // ${route.path}`
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
        writer.writeLines(`const ${segment} = ${value};`);
        value = segment;
      }

      if (terminal) {
        const useSwitch = terminal.length > 1;

        if (useSwitch) {
          writer.writeBlockStart(`switch (${value}.toLowerCase()) {`);
        }

        for (const { key, route } of terminal) {
          if (useSwitch) {
            writer.write(`case '${key}': `, true);
          } else {
            writer.write(`if (${value}.toLowerCase() === '${key}') `, true);
          }
          writer.write(
            `return ${renderMatch(verb, route!)}; // ${route!.path}\n`
          );
        }

        if (useSwitch) {
          writer.writeBlockEnd("}");
        }
      }

      if (dynamic?.route) {
        writer.writeLines(
          `if (${value}) return ${renderMatch(verb, dynamic.route)}; // ${
            dynamic.route.path
          }`
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
      if (dynamic?.static || dynamic?.dynamic) {
        const segment = `s${next}`;
        writer.writeLines(`const ${segment} = ${value};`);
        value = segment;
      }

      if (children) {
        const useSwitch = children.length > 1;

        if (useSwitch) {
          writer.writeBlockStart(`switch (${value}.toLowerCase()) {`);
        }

        for (const child of children) {
          if (useSwitch) {
            writer.writeBlockStart(`case '${child.key}': {`);
          } else {
            writer.writeBlockStart(
              `if (${value}.toLowerCase() === '${child.key}') {`
            );
          }

          const nextOffset =
            typeof offset === "string" ? index : offset + child.key.length + 1;
          writeRouterVerb(writer, child, verb, next, nextOffset);

          writer.writeBlockEnd("}");
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
      `return ${renderMatch(verb, catchAll, String(offset))}; // ${
        catchAll.path
      }`
    );
  } else if (level === 0) {
    writer.writeLines("return null;");
  }
}

function wrapPropertyName(name: string) {
  return /^[^A-Za-z_$]|[^A-Za-z0-9$_]/.test(name) ? `'${name}'` : name;
}

function renderParamsInfo(params: ParamInfo[], pathIndex?: string): string {
  if (!params.length) {
    return "{}";
  }

  let result = "";
  let catchAll = "";
  let sep = "{";

  for (const { name, index } of params) {
    if (index >= 0) {
      result += `${sep} ${wrapPropertyName(name)}: s${index + 1}`;
      sep ||= ",";
    } else if (pathIndex) {
      catchAll = name;
    }
  }

  if (catchAll) {
    result += `${sep} ${wrapPropertyName(
      catchAll
    )}: pathname.slice(${pathIndex})`;
  }

  return result ? result + " }" : "{}";
}

function renderParamsInfoType(params: ParamInfo[]): string {
  if (!params.length) {
    return "{}";
  }
  let result = "{";
  for (const { name } of params) {
    result += ` ${wrapPropertyName(name)}: string;`;
  }
  return result + " }";
}

function renderMatch(verb: HttpVerb, route: Route, pathIndex?: string) {
  const handler = `${verb}${route.index}`;
  const params = route.params?.length
    ? renderParamsInfo(route.params, pathIndex)
    : "{}";
  const meta = route.meta ? `meta${route.index}` : "{}";
  return `{ handler: ${handler}, params: ${params}, meta: ${meta} }`;
}

export function renderMiddleware(middleware: RoutableFile[]): string {
  const writer = createStringWriter();
  writer.writeLines(
    `// ${virtualFilePrefix}/${markoRunFilePrefix}middleware.js`
  );

  const imports = writer.branch("imports");
  imports.writeLines(`import { normalize } from 'virtual:marko-run/internal';`);

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
  adapter?: Adapter | null
) {
  const writer = createStringWriter();
  writer.writeLines(
    `/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/
`,
    `import type { HandlerLike, Route as AnyRoute, Context as AnyContext, ParamsObject, ValidatePath, ValidateHref } from "@marko/run";`
  );

  let platformType = "unknown";
  if (adapter && adapter.typeInfo) {
    platformType = await adapter.typeInfo((data) => writer.write(data));
    writer.writeLines("");
  }

  writer.writeLines(`
interface NoParams extends ParamsObject {}
interface NoMeta {}
`);

  const pathsWriter = writer.branch("paths");
  const routesWriter = writer.branch("types");
  const serverWriter = writer.branch("server");

  const middlewareRouteTypes = new Map<
    RoutableFile,
    { routeTypes: string[]; middleware: RoutableFile[] }
  >();

  const layoutRouteTypes = new Map<RoutableFile, { routeTypes: string[] }>();

  const getPaths = new Set<string>();
  const postPaths = new Set<string>();

  writeModuleDeclaration(serverWriter, undefined, undefined, platformType);

  for (const route of routes.list) {
    const { meta, handler, params, middleware, page, layouts } = route;
    const routeType = `Route${route.index}`;
    const pathType = `\`${route.path.replace(
      /\/\$(\$?)([^\/]*)/,
      (_, catchAll, name) => (catchAll ? `/:${name || "rest"}*` : `/:${name}`)
    )}\``;
    const paramsType = params?.length
      ? renderParamsInfoType(params)
      : "NoParams";
    let metaType = "NoMeta";

    if (page || handler) {
      const isGet = page || handler?.verbs?.includes("get");
      const isPost = handler?.verbs?.includes("post");

      if (isGet || isPost) {
        const path = route.path.replace(/\$(\$?)([^/]+)/g, (_, s, name) =>
          s ? `\${...${name}}` : `\${${name}}`
        );
        const splatIndex = path.indexOf("/${...");
        if (splatIndex >= 0) {
          const path2 = path.slice(0, splatIndex) || "/";
          isGet && getPaths.add(path2);
          isPost && postPaths.add(path2);
        }
        isGet && getPaths.add(path);
        isPost && postPaths.add(path);
      }
    }

    if (meta) {
      const path = stripTsExtension(`${pathPrefix}/${meta.relativePath}`);
      metaType = `typeof import('${path}')`;
      if (/\.(ts|js|mjs)$/.test(meta.relativePath)) {
        metaType += `['default']`;
      }
    }

    if (handler) {
      writeModuleDeclaration(
        serverWriter,
        `${pathPrefix}/${handler.relativePath}`,
        routeType,
        platformType
      );
    }

    if (page) {
      writeModuleDeclaration(
        writer,
        `${pathPrefix}/${page.relativePath}`,
        routeType,
        platformType,
        `
  export interface Input {
    renderBody: Marko.Body;
  }`
      );
    }

    if (middleware) {
      let i = 0;
      for (const mw of middleware) {
        const existing = middlewareRouteTypes.get(mw);
        if (!existing) {
          middlewareRouteTypes.set(mw, {
            routeTypes: [routeType],
            middleware: middleware.slice(0, i),
          });
        } else {
          existing.routeTypes.push(routeType);
        }
        i++;
      }
    }

    if (layouts) {
      for (const layout of layouts) {
        const existing = layoutRouteTypes.get(layout);
        if (!existing) {
          layoutRouteTypes.set(layout, {
            routeTypes: [routeType],
          });
        } else {
          existing.routeTypes.push(routeType);
        }
      }
    }

    routesWriter.writeLines(
      `type ${routeType} = AnyRoute<${paramsType}, ${metaType}, ${pathType}>;`
    );
  }

  pathsWriter.write(`type Get =`);
  if (getPaths.size) {
    for (const path of getPaths) {
      pathsWriter.write(`\n  | '${path}'`);
    }
  } else {
    pathsWriter.write(" never");
  }
  pathsWriter.writeLines(";", "");
  pathsWriter.write("type Post =");
  if (postPaths.size) {
    for (const path of postPaths) {
      pathsWriter.write(`\n  | '${path}'`);
    }
  } else {
    pathsWriter.write(" never");
  }
  pathsWriter.writeLines(";", "");

  pathsWriter.join();

  for (const [file, { routeTypes }] of middlewareRouteTypes) {
    writeModuleDeclaration(
      serverWriter,
      `${pathPrefix}/${file.relativePath}`,
      routeTypes.join(" | "),
      platformType
    );
  }

  for (const [file, { routeTypes }] of layoutRouteTypes) {
    writeModuleDeclaration(
      writer,
      `${pathPrefix}/${file.relativePath}`,
      routeTypes.join(" | "),
      platformType,
      `
  export interface Input {
    renderBody: Marko.Body;
  }`
    );
  }

  if (routes.special["404"]?.page) {
    writeModuleDeclaration(
      writer,
      `${pathPrefix}/${routes.special["404"].page.relativePath}`,
      undefined,
      platformType,
      `
  export interface Input {}`
    );
  }

  if (routes.special["500"]?.page) {
    writeModuleDeclaration(
      writer,
      `${pathPrefix}/${routes.special["500"].page.relativePath}`,
      undefined,
      platformType,
      `
  export interface Input {
    error: unknown;
  }`
    );
  }

  serverWriter.join();

  return writer.end();
}

function writeModuleDeclaration(
  writer: Writer,
  path: string = "global",
  routeType: string = "AnyRoute",
  platformType: string = "unknown",
  moduleTypes?: string
) {
  writer.writeLines("");

  if (path === "global") {
    writer.write("declare global {");
  } else {
    writer.write(`declare module '${stripTsExtension(path)}' {`);
  }

  if (moduleTypes) {
    writer.writeLines(moduleTypes);
  }

  const isMarko = path.endsWith(".marko");

  writer.write(`
  namespace MarkoRun {
    type GetPaths = Get;
    type PostPaths = Post;
    type GetablePath<T extends string> = ValidatePath<Get, T>;
    type GetableHref<T extends string> = ValidateHref<Get, T>; 
    type PostablePath<T extends string> = ValidatePath<Post, T>;
    type PostableHref<T extends string> = ValidateHref<Post, T>;
    type Platform = ${platformType};`);

  if (path !== "global") {
    writer.write(`
    type Route = ${routeType};
    type Context = AnyContext<Platform, Route>${
      isMarko ? " & Marko.Global" : ""
    };
    type Handler<_Params = Route['params'], _Meta = Route['meta']> = HandlerLike<Route>;
    function route(handler: Handler): typeof handler;
    function route<_Params = Route['params'], _Meta = Route['meta']>(handler: Handler): typeof handler;
    const NotHandled: unique symbol;
    const NotMatched: unique symbol;`);
  }

  writer.writeLines(`
  }
}`);
}

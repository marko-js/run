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

function normalizedRelativePath(from: string, to: string): string {
  const relativePath = normalizePath(path.relative(from, to));
  return relativePath.startsWith(".") ? relativePath : "./" + relativePath;
}

export function renderRouteTemplate(
  route: Route,
  markoApi?: string,
  dev = false,
  persisted = false,
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

  // Persisted pages: bootstrap the client router with the app's route table
  // (patterns + lazy loaders for every route's template module and `?update`
  // entry — same-route navigations load only this route's entry chunk;
  // cross-route navigations also load the target's code) and this route's
  // own pattern. Special (404/500) pages have no pattern to navigate within,
  // and the class API has no persisted support.
  if (
    persisted &&
    markoApi !== "class" &&
    route.key !== RoutableFileTypes.NotFound &&
    route.key !== RoutableFileTypes.Error
  ) {
    importWriter.writeLines(
      `client import { register as __run_persisted_register } from "${virtualFilePrefix}/runtime/persisted";
client import __run_persisted_routes from "${virtualFilePrefix}/${ROUTES_CLIENT_FILENAME}";`,
    );
    writer.writeLines(
      `<script>
  __run_persisted_register(__run_persisted_routes, ${JSON.stringify(route.path.path)}, $global.buildHash);
</script>`,
    );
  }
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
  const imports = writer.branch("imports");
  const runtimeImports: string[] = [];

  if (handler) {
    runtimeImports.push("normalizeHandler");
  }
  if (meta) {
    runtimeImports.push("normalizeMeta");
  }
  if (handler || middleware.length) {
    runtimeImports.push("call", "mergeOptions");
  }
  if (page) {
    runtimeImports.push("render");
  }
  if (
    !page ||
    verbs.some(
      (verb) => !(verb === "get" || verb === "head" || verb === "post"),
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
        `const ${verb}Handler = normalizeHandler(${importName});`,
      );
    }
    imports.writeLines(
      `import { ${names.join(", ")} } from "${normalizedRelativePath(rootDir, handler.filePath)}";`,
    );
  }

  if (page) {
    imports.writeLines(
      `import page from "${normalizedRelativePath(rootDir, route.templateFilePath!)}";`,
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
    writeRouteEntryHandler(writer, route, verb);
  }

  optionsWriter.join();

  return writer.end();
}

function writeRouteOptions(writer: Writer, route: Route, verb: HttpVerb): void {
  const hasHandler = route.handler?.verbs?.includes(verb);
  writer.write(`export const ${verb}${route.index}_options = `);

  if (route.middleware.length || hasHandler) {
    writer.write(`mergeOptions(`);

    let sep = "";
    for (const { id } of route.middleware) {
      writer.write(`${sep}mware${id}`);
      sep = ", ";
    }
    if (hasHandler) {
      writer.write(`${sep}${verb}Handler`);
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

  if (page && (verb === "get" || verb === "head" || verb === "post")) {
    currentName = "__page";
    if (handler?.verbs?.includes(verb)) {
      const name = `${verb}Handler`;

      continuations.writeLines(
        `const ${currentName} = (data) => render(context, page, {}, data);`,
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
        `const ${currentName} = (data) => render(context, page, {}, data);`,
      );
    } else {
      writer.writeLines(`return render(context, page, {});`);
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

export function renderRouter(
  routes: BuiltRoutes,
  rootDir: string,
  runtimeInclude?: string,
  options: RouterOptions = {
    trailingSlashes: "RedirectWithout",
  },
): string {
  const writer = createStringWriter();

  const hasErrorPage = Boolean(routes.special[RoutableFileTypes.Error]);
  const hasNotFoundPage = Boolean(routes.special[RoutableFileTypes.NotFound]);

  const imports = writer.branch("imports");

  if (runtimeInclude) {
    imports.writeLines(`import "${normalizePath(runtimeInclude)}";`);
  }

  imports.writeLines(
    `import { NotHandled, NotMatched, createContext } from "${virtualFilePrefix}/runtime/internal";`,
  );

  if (options.persisted) {
    // Build identity for persisted-update gating: @marko/vite's linkAssets
    // runtime exposes the client build's digest (undefined in dev, where a
    // per-process token stands in — a dev-server restart then falls back to
    // full navigations instead of applying stale updates).
    imports.writeLines(
      `import { buildId } from "virtual:marko-vite/link-assets";

let resolvedBuildHash;
function getBuildHash() {
  return (resolvedBuildHash ??=
    buildId() || Math.random().toString(36).slice(2));
}`,
    );
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
      `import page${route.key} from "${normalizedRelativePath(rootDir, route.templateFilePath!)}";`,
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

  if (options.persisted) {
    // Persisted pages: every render is persisted-capable and carries the
    // build's identity (serialized so the client router can send it back).
    // A navigation fetch negotiates an update render instead, but only when
    // the client's loaded route matches the one this URL resolves to (route
    // ranking can send a pattern-matching URL to a different route) AND the
    // client's build matches this server's (compiled accessors and register
    // ids are only stable within one build) — otherwise a 409 tells the
    // client router to fall back to a full navigation.
    writer.writeLines(
      `context.persisted = true;
  context.buildHash = getBuildHash();
  context.serializedGlobals.buildHash = true;
  if (
    route &&
    request.method === "GET" &&
    request.headers.get("accept")?.includes("text/marko-patch")
  ) {
    if (
      request.headers.get("x-marko-route") === route.path &&
      request.headers.get("x-marko-build") === context.buildHash
    ) {
      context.persisted = "update";
    } else {
      return new Response(null, { status: 409, headers: { vary: "accept" } });
    }
  }`,
    );
  }

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
  const name = `${verb}${route.index}`;
  const params = path.params ? renderParams(path.params, pathIndex) : "{}";
  const meta = route.meta ? `${name}_meta` : "{}";
  return `{ handler: ${name}, path: '${path.path}', params: ${params}, options: ${name}_options, meta: ${meta} }`;
}

/** Basename of the generated client route-table module (persisted pages). */
export const ROUTES_CLIENT_FILENAME = `${markoRunFilePrefix}routes.client.js`;

/**
 * Persisted-pages client route table: path patterns with lazy loaders for
 * each route's generated template module (importing it registers the
 * route's renderers, signals, and update merges) and its `?update` entry
 * (the compiled merge functions). The client router matches link clicks
 * against the patterns; the server's `x-marko-route` verification catches
 * ranking differences (mismatches 409 into a full navigation).
 */
export function renderRoutesClient(
  routes: BuiltRoutes,
  rootDir: string,
): string {
  const writer = createStringWriter();
  writer.writeBlockStart("export default [");
  for (const route of routes.list) {
    if (!route.page || !route.templateFilePath) continue;
    const templatePath = normalizedRelativePath(
      rootDir,
      route.templateFilePath,
    );
    writer.writeLines(
      `[${JSON.stringify(route.path.path)}, () => import(${JSON.stringify(templatePath)}), () => import(${JSON.stringify(`${templatePath}?update`)})],`,
    );
  }
  writer.writeBlockEnd("];");
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

interface RoutableFileInfo {
  id: string;
  typeName: "Middleware" | "Handler" | "Template" | "Meta" | null;
  modulePath: string;
  routes: Set<Route>;
}

function* routeFileIter(route: Route) {
  yield* route.middleware;
  if (route.handler) yield route.handler;
  yield* route.layouts;
  if (route.page) yield route.page;
  if (route.meta) yield route.meta;
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
    export type Route = ${
      info.routes.size
        ? `$.Routes[${[...info.routes]
            .map((route) => JSON.stringify(route.path.path))
            .join(" | ")}]`
        : "globalThis.MarkoRun.Route"
    };
    export type Context = ${
      info.modulePath.endsWith(".marko")
        ? "Run.Context"
        : "$.MultiRouteContext<Route>"
    };
    export type Handler = $.HandlerLike<Route>;`);
      for (const verb of httpVerbs) {
        writer.write(`
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

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
  HttpVerb,
  Route,
  BuiltRoutes,
  RouteTrie,
  ParamInfo,
  RoutableFile,
  CodegenOptions,
} from "../types";
import type { Writer } from "./writer";
import { getVerbs, hasVerb } from "../utils/route";

export const DefaultCodegenOptions: CodegenOptions = {
  trailingSlashes: "RedirectWithout",
};

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

  if (runtimeImports.length) {
    imports.writeLines(
      `import { ${runtimeImports.join(", ")} } from '${virtualRuntimePrefix}';`
    );
  }

  if (middleware.length) {
    const names = middleware.map((m) => `mware$${m.id}`);
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
      const name = verb === "delete" ? "del" : verb;
      names.push(name);
      // writer.writeLines(`let handler$${name};`);
      writer.writeLines(`const handler$${name} = normalize(${name});`);
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
      `export { default as meta$${index} } from './${meta.importPath}';`
    );
  }

  for (const verb of verbs) {
    writeRouteEntryHandler(writer, route, verb);
  }

  return writer.end();
}

function writePageResponse(writer: Writer, wrapFn?: string): void {
  const pre = wrapFn ? `const ${wrapFn} = () =>` : "return";
  writer.writeBlock(
    `${pre} new Response(page.stream(context), {`,
    ["status: 200,", 'headers: { "content-type": "text/html;charset=UTF-8" }'],
    "});"
  );
}

function writeMiddleware(
  writer: Writer,
  middleware: string,
  next: string,
  wrapFn?: string
): void {
  const pre = wrapFn ? `const ${wrapFn} = () =>` : "return";
  writer.writeLines(`${pre} call(${middleware}, ${next}, context);`);
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

  writer
    .writeLines("")
    .writeBlockStart(`export async function ${verb}$${index}(context) {`);

  const continuations = writer.branch("cont");

  if (page && verb === "get") {
    currentName = "__page";
    if (handler?.verbs?.includes(verb)) {
      const name = `handler$${verb}`;

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
    const name = `handler$${verb}`;
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
      const name = `mware$${id}`;
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
  options: CodegenOptions = DefaultCodegenOptions
): string {
  const writer = createStringWriter();

  writer.writeLines(`// @marko/run/router`);

  const imports = writer.branch("imports");

  for (const route of routes.list) {
    const verbs = getVerbs(route);
    const names = verbs.map((verb) => `${verb}$${route.index}`);
    route.meta && names.push(`meta$${route.index}`);

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
      `import page$${key} from '${virtualFilePrefix}/${markoRunFilePrefix}special__${key}.marko${serverEntryQuery}';`
    );
  }

  writer
    .writeLines(``)
    .writeBlockStart(`function findRoute(method, pathname) {`)
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
export function matchRoute(method, pathname) {
  if (!pathname) {
    pathname = '/';
  } else if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname;
  }
  return findRoute(method, pathname);
}

export async function invokeRoute(route, context) {
	try {
		if (route) {
			context.data = {};
			context.params = route.params;
			context.meta = route.meta;
			const response = await route.handler(context);
			if (response) return response;
`).indent = 2;

  if (routes.special[RoutableFileTypes.NotFound]) {
    writer.write(
      `    } else {
      context.data = {};
      context.params = {};
      context.meta = {};
    }
    if (context.request.headers.get('Accept')?.includes('text/html')) {
      return new Response(page$404.stream(context), {
        status: 404,
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }`
    );
  } else {
    writer.writeBlockEnd("}");
  }

  writer.indent--;
  writer
    .writeBlockStart(`} catch (err) {`)
    .writeLines(`if (err == null) return;`);

  if (routes.special[RoutableFileTypes.Error]) {
    writer
      .writeBlockStart(
        `if (context.request.headers.get('Accept')?.includes('text/html')) {`
      )
      .writeLines(`context.data.error = err;`)
      .writeBlock(
        `return new Response(page$500.stream(context), {`,
        [
          `status: 500,`,
          `headers: { "content-type": "text/html;charset=UTF-8" },`,
        ],
        `});`
      )
      .writeBlockEnd("}");
  }

  writer.writeLines(`throw err;`).writeBlockEnd("}").writeBlockEnd("}").write(`
export async function router(context) {
  try {
    const { url, method } = context;
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

    const route = matchRoute(method, pathname);
    return await invokeRoute(route, context);
  } catch (err) {
    const message = import.meta.env.DEV
      ? \`Internal Server Error (\${err.message})\`
      : "Internal Server Error";

    return new Response(
      JSON.stringify({
        error: {
          message,
          stack: import.meta.env.DEV
            ? \`This will only be seen in development mode\\n\\n\${err.stack}\`
            : ""
        }
      }),
      {
        statusText: message,
        status: 500,
      }
    );
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

// function writeRouterVerb(
//   writer: Writer,
//   trie: RouteTrie,
//   verb: HttpVerb,
//   level: number = 0,
//   offset: number | string = 1
// ): void {
//   const { route: value, static: children, dynamic, catchAll } = trie;
//   const next = level + 1;
//   const index = `i${next}`;
//   const segment = `s${next}`;
//   let needsClose = false;

//   if (level === 0) {
//     writer.writeLines(`const len = pathname.length;`);

//     if (value) {
//       writer.writeLines(
//         `if (len === 1) return ${renderMatch(verb, value)}; // ${value.path}`
//       );
//     } else if (children || dynamic) {
//       writer.writeBlockStart(`if (len > 1) {`);
//       needsClose = true;
//     }
//   }
//   if (children || dynamic) {
//     writer.writeLines(`const ${index} = pathname.indexOf('/', ${offset}) + 1;`);

//     let terminalRoutes: RouteTrie[] | undefined;
//     let terminalSwitch = false;
//     let childrenRoutes: RouteTrie[] | undefined;
//     let childrenSwitch = false;
//     const terminalWriter = writer.branch("terminal" + level);
//     const childrenWriter = writer.branch("children" + level);
//     childrenWriter.indent++;

//     if (children) {
//       for (const child of children.values()) {
//         if (child.route) {
//           if (!terminalRoutes) {
//             terminalRoutes = [child];
//             terminalWriter
//               .writeBlockStart(`if (!${index} || ${index} === len) {`)
//               .writeLines(
//                 `const ${segment} = pathname.slice(${offset}, ${index} ? -1 : len);`
//               );
//           } else {
//             if (terminalRoutes.push(child) === 2) {
//               const pending = terminalRoutes[0];
//               terminalSwitch = true;
//               terminalWriter
//                 .writeBlockStart(`switch (${segment}.toLowerCase()) {`)
//                 .writeLines(
//                   `case '${pending.key}': return ${renderMatch(
//                     verb,
//                     pending.route!
//                   )}; // ${pending.route!.path}`
//                 );
//             }
//             terminalWriter.writeLines(
//               `case '${child.key}': return ${renderMatch(
//                 verb,
//                 child.route
//               )}; // ${child.route.path}`
//             );
//           }
//         }

//         if (child.static || child.dynamic || child.catchAll) {
//           if (!childrenRoutes) {
//             childrenRoutes = [child];
//             childrenWriter.writeLines(
//               `const ${segment} = pathname.slice(${offset}, ${index} - 1);`
//             );
//           } else {
//             if (childrenRoutes.push(child) === 2) {
//               const pending = childrenRoutes[0];
//               childrenSwitch = true;
//               childrenWriter
//                 .writeBlockStart(`switch (${segment}.toLowerCase()) {`)
//                 .writeBlockStart(`case '${pending.key}': {`);
//               writeRouterVerb(
//                 childrenWriter,
//                 pending,
//                 verb,
//                 next,
//                 typeof offset === "string"
//                   ? index
//                   : offset + pending.key.length + 1
//               );
//               childrenWriter.writeBlockEnd("}");
//             }
//             childrenWriter.writeBlockStart(`case '${child.key}': {`);
//             writeRouterVerb(
//               childrenWriter,
//               child,
//               verb,
//               next,
//               typeof offset === "string" ? index : offset + child.key.length + 1
//             );
//             childrenWriter.writeBlockEnd("}");
//           }
//         }
//       }
//     }

//     if (dynamic) {
//       if (dynamic.route) {
//         if (!terminalRoutes) {
//           terminalRoutes = [];
//           terminalWriter
//             .writeBlockStart(`if (!${index} || ${index} === len) {`)
//             .writeLines(
//               `const ${segment} = pathname.slice(${offset}, ${index} ? -1 : len);`
//             );
//         } else {
//           if (terminalRoutes.push(dynamic) === 2) {
//             const pending = terminalRoutes[0];
//             terminalWriter.writeLines(
//               `if (${segment}.toLowerCase() === '${
//                 pending.key
//               }') return ${renderMatch(verb, pending.route!)}; // ${
//                 pending.route!.path
//               }`
//             );
//           }
//         }
//           terminalWriter.writeLines(
//             `if (${segment}) return ${renderMatch(verb, dynamic.route)}; // ${
//               dynamic.route.path
//             }`
//           );
//       }
//       if (dynamic.static || dynamic.dynamic || dynamic.catchAll) {
//         if (!childrenRoutes) {
//           childrenRoutes = [];
//           childrenWriter.writeLines(
//             `const ${segment} = pathname.slice(${offset}, ${index} - 1);`
//           );
//         } else {
//           childrenRoutes.push(dynamic);
//         }
//         childrenWriter.writeBlockStart(`if (s${next}) {`);
//         writeRouterVerb(childrenWriter, dynamic, verb, next, `i${next}`);
//         childrenWriter.writeBlockEnd(`}`);
//       }
//     }

//     if (terminalRoutes) {
//       if (terminalRoutes.length === 1) {
//         const pending = terminalRoutes[0];
//         terminalWriter.writeLines(
//           `if (${segment}.toLowerCase() === '${
//             pending.key
//           }') return ${renderMatch(verb, pending.route!)}; // ${
//             pending.route!.path
//           }`
//         );
//       } else if (terminalSwitch) {
//         terminalWriter.writeBlockEnd("}");
//       }
//     }

//     if (childrenRoutes) {
//       if (childrenRoutes.length === 1) {
//         const pending = childrenRoutes[0];
//         childrenWriter.writeBlockStart(
//           `if (${segment}.toLowerCase() === '${pending.key}') {`
//         );
//         writeRouterVerb(
//           childrenWriter,
//           pending,
//           verb,
//           next,
//           typeof offset === "string" ? index : offset + pending.key.length + 1
//         );
//         childrenWriter.writeBlockEnd("}");
//       } else if (childrenSwitch) {
//         childrenWriter.writeBlockEnd("}");
//       }
//     }

//     if (terminalRoutes && childrenRoutes) {
//       terminalWriter.writeBlockEnd("} else {");
//       childrenWriter.writeBlockEnd('}');
//     } else if (terminalRoutes) {
//       terminalWriter.writeBlockEnd("}");
//     } else if (childrenRoutes) {
//       terminalWriter.writeBlockStart(`if (${index} && ${index} !== len) {`);
//       childrenWriter.writeBlockEnd("}");
//     } else {
//     }
//     terminalWriter.join();
//     childrenWriter.join();
//   }

//   if (needsClose) {
//     writer.writeBlockEnd('}');
//   }

//   if (catchAll) {
//     writer.writeLines(
//       `return ${renderMatch(verb, catchAll, String(offset))}; // ${
//         catchAll.path
//       }`
//     );
//   } else if (level === 0) {
//     writer.writeLines("return null;");
//   }
// }

// function writeRouterVerb(
//   writer: Writer,
//   trie: RouteTrie,
//   verb: HttpVerb,
//   level: number = 0,
//   offset: number | string = 1
// ): void {
//   const { route: value, static: children, dynamic, catchAll } = trie;

//   if (level === 0) {
//     writer.writeLines(`const len = pathname.length;`);
//   }

//   if (value) {
//     if (level > 0) {
//       writer.writeLines(
//         `if (i${level} === -1 || i${level} === iLast) return ${renderMatch(verb, value)}; // ${
//           value.path
//         }`
//       );
//     } else {
//       writer.writeLines(
//         `if (len === 1) return ${renderMatch(verb, value)}; // ${value.path}`
//       );
//     }
//   }

//   if (children || dynamic) {
//     if (!value) {
//       if (level === 0) {
//         writer.writeBlockStart(`if (len > 1) {`);
//       } else {
//         writer.writeBlockStart(`if (i${level} !== -1 && i${level} !== iLast) {`);
//       }
//     }

//     if (level === 0) {
//       writer.writeLines(`const iLast = len - 1;`);
//     }

//     const next = level + 1;
//     const index = `i${next}`;
//     const segment = `s${next}`;
//     writer.writeLines(
//       `const ${index} = pathname.indexOf('/', ${offset});`,
//       `const ${segment} = pathname.slice(${offset}, ${index} === -1 ? len : ${index});`
//     );

//     if (children) {
//       const useSwitch = children.size > 1;
//       if (useSwitch) {
//         writer.writeBlockStart(`switch(${segment}.toLowerCase()) {`);
//       }
//       for (const child of children.values()) {
//         if (useSwitch) {
//           writer.writeBlockStart(`case '${child.key}': {`);
//         } else {
//           writer.writeBlockStart(
//             `if (${segment}.toLowerCase() === '${child.key}') {`
//           );
//         }

//         if (typeof offset === "string") {
//           writeRouterVerb(writer, child, verb, next, `${index} + 1`);
//         } else {
//           writeRouterVerb(
//             writer,
//             child,
//             verb,
//             next,
//             offset + child.key.length + 1
//           );
//         }
//         if (useSwitch && !child.catchAll) {
//           writer.writeLines("break;");
//         }
//         writer.writeBlockEnd("}");
//       }
//       if (useSwitch) {
//         writer.writeBlockEnd("}");
//       }
//     }

//     if (dynamic) {
//       writer.writeBlockStart(`if (s${next}) {`);
//       writeRouterVerb(writer, dynamic, verb, next, `i${next} + 1`);
//       writer.writeBlockEnd("}");
//     }

//     if (!value) {
//       writer.writeBlockEnd(`}`);
//     }
//   }

//   if (catchAll) {
//     writer.writeLines(
//       `return ${renderMatch(verb, catchAll, String(offset))}; // ${
//         catchAll.path
//       }`
//     );
//   } else if (level === 0) {
//     writer.writeLines("return null;");
//   }
// }

// function writeRouterVerb__split(
//   writer: Writer,
//   trie: RouteTrie,
//   verb: HttpVerb,
//   level: number = 0,
//   pathIndex: number = 0,
//   useSwitch?: boolean
// ): void {
//   const { key, route: value, static: children, dynamic, catchAll } = trie;
//   pathIndex += key.length;

//   if (level <= 0) {
//     level = 0;

//     if (value) {
//       writer.writeLines(
//         `if (pathname === '/') return ${renderMatch(verb, value)}; // ${
//           value.path
//         }`
//       );
//     }

//     if (children || dynamic) {
//       writer.writeLines(
//         `const segments = pathname.split('/');`,
//         `const len = segments.length;`
//       );
//     }
//   } else {
//     if (!key) {
//       writer.writeBlockStart(`if (segments[${level}]) {`);
//     } else if (useSwitch) {
//       writer.writeBlockStart(`case '${key}':`);
//     } else {
//       writer.writeBlockStart(
//         `if (segments[${level}]?.toLowerCase() === '${key}') {`
//       );
//     }

//     if (value) {
//       writer.writeLines(
//         `if (len === ${level + 1}) return ${renderMatch(verb, value)}; // ${
//           value.path
//         }`
//       );
//     }
//   }

//   if (children || dynamic) {
//     if (children) {
//       if (children.size > 1) {
//         writer.writeBlockStart(
//           `switch(segments[${level + 1}]?.toLowerCase()) {`
//         );
//         for (const child of children.values()) {
//           writeRouterVerb(writer, child, verb, level + 1, pathIndex, true);
//         }
//         writer.writeBlockEnd("}");
//       } else {
//         for (const child of children.values()) {
//           writeRouterVerb(writer, child, verb, level + 1, pathIndex);
//         }
//       }
//     }

//     if (dynamic) {
//       writeRouterVerb(writer, dynamic, verb, level + 1, pathIndex);
//     }
//   }

//   if (catchAll) {
//     writer.writeLines(
//       `return ${renderMatch(verb, catchAll, pathIndex)}; // ${catchAll.path}`
//     );

//     if (level > 0) {
//       writer.indent--;
//     }
//   } else if (level === 0) {
//     writer.writeLines("return null;");
//   } else if (useSwitch) {
//     writer.writeLines("break;").indent--;
//   } else {
//     writer.writeBlockEnd("}");
//   }
// }

function wrapPropertyName(name: string) {
  return /^[^A-Za-z_$]|[^A-Za-z0-9$_]/.test(name) ? `'${name}'` : name;
}

function renderParamsInfo(params: ParamInfo[], pathIndex?: string): string {
  if (!params.length) {
    return "{}";
  }

  let result = "{";
  let catchAll = "";
  let sep = "";

  for (const { name, index } of params) {
    if (index >= 0) {
      result += `${sep} ${wrapPropertyName(name)}: s${index + 1}`;
      sep ||= ",";
    } else if (pathIndex) {
      catchAll = name;
      sep ||= ",";
    }
  }

  if (catchAll) {
    result += `${sep} ${wrapPropertyName(
      catchAll
    )}: pathname.slice(${pathIndex})`;
  }

  return sep ? result + "}" : "{}";
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
  // return `'${verb}:${route.path}'`
  const handler = `${verb}$${route.index}`;
  const params = route.params?.length
    ? renderParamsInfo(route.params, pathIndex)
    : "{}";
  const meta = route.meta ? `meta$${route.index}` : "{}";
  //return `[${handler}, ${params}, ${meta}]`;
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
    const importName = `mware${id}`;
    imports.writeLines(`import ${importName} from './${importPath}';`);
    writer.writeLines(`export const mware$${id} = normalize(${importName});`);
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

export function renderRouteTypeInfo(routes: BuiltRoutes) {
  const writer = createStringWriter();
  writer.writeLines(
    `/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/
  `,
    `import { HandlerLike, Route, RouteData } from "@marko/run";`,
    `type Combine<T> = T extends object ? { [P in keyof T]: T[P] } : T;`,
    `type ExtractHandlerData<T> = T extends HandlerLike<any, RouteData<infer P, infer E>> ? Combine<P & E> : undefined;`,
    `interface Empty {}
    `);

  const routesWriter = writer.branch("types");
  const dataWriter = writer.branch("data");

  const middlewareRouteTypes = new Map<
    RoutableFile,
    { routeTypes: string[]; middleware: RoutableFile[] }
  >();

  for (const route of routes.list) {
    const { meta, handler, params, middleware } = route;
    const routeType = `Route${route.index}`;
    const pathType = `\`${route.path.replace(/\/\$([^\/]+)/g, "/:$1")}\``;
    const paramsType = params ? renderParamsInfoType(params) : "{}";
    let metaType = "undefined";

    if (meta) {
      metaType = `typeof import('./${stripTsExtension(meta.relativePath)}')`;
      if (/\.(ts|js|mjs)$/.test(meta.relativePath)) {
        metaType += `['default']`;
      }
    }

    if (handler) {
      let dataType = middleware.map((mw) => `Data${mw.id}`).join(" & ");
      if (!middleware.length) {
        dataType = "Empty";
      } else if (middleware.length > 1) {
        dataType = `Combine<${dataType}>`;
      }

      writer.writeLines(`
declare module './${stripTsExtension(handler.relativePath)}' {
  namespace Marko {
    interface CurrentRoute extends ${routeType} {}
    type CurrentData = ${dataType};
    type Handler<Data extends Record<string, any> = {}, _Params = any, _Meta = any> = HandlerLike<CurrentRoute, RouteData<Data, CurrentData>>;
    function route<Data extends Record<string, any> = {}, _Params = any, _Meta = any>(handler: Handler<Data>): typeof handler;
  }
}`);
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

    routesWriter.writeLines(
      `interface ${routeType} extends Route<${paramsType}, ${metaType}, ${pathType}> {}`
    );
  }

  for (const [file, { routeTypes, middleware }] of middlewareRouteTypes) {
    let dataImport = `typeof import('./${stripTsExtension(file.relativePath)}')`;
    if (/\.(ts|js|mjs)$/.test(file.relativePath)) {
      dataImport += `['default']`;
    }
    dataWriter.writeLines(
      `type Data${file.id} = ExtractHandlerData<${dataImport}>;`
    );

    let dataType = middleware.map((mw) => `Data${mw.id}`).join(" & ");
    if (!middleware.length) {
      dataType = "Empty";
    } else if (middleware.length > 1) {
      dataType = `Combine<${dataType}>`;
    }
    
    writer.writeLines(`
declare module './${stripTsExtension(file.relativePath)}' {
  namespace Marko {
    type CurrentRoute = ${routeTypes.join(" | ")};
    type CurrentData = ${dataType};
    type Handler<Data extends Record<string, any> = {}, _Params = any, _Meta = any> = HandlerLike<CurrentRoute, RouteData<Data, CurrentData>>;
    function route<Data extends Record<string, any> = {}, _Params = any, _Meta = any>(handler: Handler<Data>): typeof handler;
  }
}`);
  }

  return writer.end();
}

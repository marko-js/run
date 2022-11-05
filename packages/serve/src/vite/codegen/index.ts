import { httpVerbs, RoutableFileTypes, serverEntryQuery, virtualFilePrefix, markoServeFilePrefix } from '../constants';
import { createStringWriter } from './writer';
import { createRouteTrie } from '../routes/routeTrie';
import type { HttpVerb, Route, BuiltRoutes, RouteTrie, ParamInfo, RoutableFile } from '../types';
import type { Writer } from './writer';
import { getVerbs, hasVerb } from '../utils/route';

export function renderRouteTemplate(route: Route): string {
  if (!route.page) {
    throw new Error(`Route ${route.key} has no page to render`);
  }

  const writer = createStringWriter();
  writer.writeLines(`// ${virtualFilePrefix}/${markoServeFilePrefix}route__${route.key}.marko`);
  writer.branch('imports')
  writer.writeLines('')
  writeRouteTemplateTag(writer, [...route.layouts, route.page]);

  return writer.end();
}

function writeRouteTemplateTag(writer: Writer, [file, ...rest]: RoutableFile[], index: number = 1): void {
  if (file) {
    const isLast = !rest.length;
    const tag = isLast ? 'page' : `layout${index}`;

    writer.branch('imports').writeLines(`import ${tag} from './${file.importPath}';`)

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
    throw new Error(`Route ${key} doesn't have a handler or page for any HTTP verbs`);
  }
  
  const writer = createStringWriter();
  
  writer.writeLines(`// ${virtualFilePrefix}/${markoServeFilePrefix}route__${key}.js`);

  const imports = writer.branch('imports');

  let i = 1;
  for (const { importPath } of middleware) {
    imports.writeLines(`import middleware$${i} from './${importPath}';`);
    i++;
  }

  if (handler?.verbs?.length) {
    const names = handler.verbs.map(verb => `${verb === 'delete' ? 'del' : verb} as handler$${verb}`);
    imports.writeLines(`import { ${names.join(', ')} } from './${handler.importPath}';`);
  }
  if (page) {
    imports.writeLines(`import page from '${virtualFilePrefix}/${markoServeFilePrefix}route__${key}.marko${serverEntryQuery}';`);
  }
  if (meta) {
    imports.writeLines(`export { default as meta$${index} } from './${meta.importPath}';`);
  }

  if (!page || verbs.length > 1) {
    writer
      .writeLines('')
      .writeBlockStart(`function create204Response() {`)
      .writeBlockStart(`return new Response(null, {`)
      .writeLines(`status: 204`)
      .writeBlockEnd(`})`)	
      .writeBlockEnd(`}`);
  }

  for (const verb of verbs) {
    writeRouteEntryHandler(writer, route, verb);
  }

  return writer.end();
}

function writePageResponseContinuation(writer: Writer): void {
  writer.writeBlock(
    `return new Response(page.stream(ctx), {`,[
      'status: 200,',
      'headers: { "content-type": "text/html;charset=UTF-8" }'],
    '});')
}

function writeRouteEntryHandler(writer: Writer, route: Route, verb: HttpVerb): void {
  const { key, index, page, handler, middleware } = route;
  const len = middleware.length;

  let nextName: string;
  let currentName: string;
  let hasBody = false;
  
  writer.writeLines('').writeBlockStart(`export async function ${verb}$${index}(ctx) {`);

  const continuations = writer.branch('cont');

  if (page && verb === 'get') {
    currentName = 'createPageResponse';
    if (handler?.verbs?.includes(verb)) {
      continuations.writeBlockStart(`async function ${currentName}() {`);
      writePageResponseContinuation(continuations);
      continuations.writeBlockEnd('}');
      
      if (len) {
        nextName = currentName
        currentName = `__handler$${verb}`;
        continuations.writeBlock(
          `async function ${currentName}() {`, [
            `return await handler$${verb}(ctx, ${nextName});`],
          '}');
      } else {
        writer.writeLines(`return await handler$${verb}(ctx, ${currentName})`);
        hasBody = true;
      }
    } else if (len) {
      continuations.writeBlockStart(`async function ${currentName}() {`);
      writePageResponseContinuation(continuations);
      continuations.writeBlockEnd('}');
      nextName = currentName;
    } else {
      writePageResponseContinuation(continuations);
      hasBody = true;
    }
  } else if (handler) {
    currentName = `__handler$${verb}`;

    if (len) {
      continuations.writeBlock(
        `async function ${currentName}() {`, [
          `return await handler$${verb}(ctx, create204Response);`],
        '}');
    } else {
      writer.writeLines(`return await handler$${verb}(ctx, create204Response);`);
      hasBody = true;
    }
  } else {
    throw new Error(`Route ${key} has no handler for ${verb} requests`);
  }
  
  if (!hasBody) {
    let i = len;
    while (--i) {
      nextName = currentName;
      currentName = `__middleware${i + 1}`;

      continuations.writeLines('').writeBlock(
        `async function ${currentName}() {`, [
          `return await middleware$${i + 1}(ctx, ${nextName});`],
        '}');
    }

    writer.writeLines(`return await middleware$1(ctx, ${currentName});`);
  }

  continuations.join();

  writer.writeBlockEnd('}')
}


export function renderRouter(routes: BuiltRoutes): string {
  const writer = createStringWriter();
  
  writer.writeLines(`// @marko/serve/router`);

  const imports = writer.branch('imports');

  for (const route of routes.list) {
    const verbs = getVerbs(route);
    const names = verbs.map(verb => `${verb}$${route.index}`);
    route.meta && names.push(`meta$${route.index}`);

    imports.writeLines(`import { ${names.join(', ')} } from '${virtualFilePrefix}/${markoServeFilePrefix}route__${route.key}.js';`);
  }
  for (const { key } of Object.values(routes.special)) {
    imports.writeLines(`import page$${key} from '${virtualFilePrefix}/${markoServeFilePrefix}special__${key}.marko${serverEntryQuery}';`);
  }

  writer
    .writeLines('')
    .writeLines('globalThis.__MARKO_SERVE_RUNTIME__ = { router, getMatchedRoute };')
    .writeLines('')
    .writeBlockStart(`function matchRoute(method, pathname) {`)
    .writeBlockStart(`switch (method.toLowerCase()) {`);

  for (const verb of httpVerbs) {
    const filteredRoutes = routes.list.filter(route => hasVerb(route, verb));
    if (filteredRoutes.length) {
      const trie = createRouteTrie(filteredRoutes);
      writer.writeBlockStart(`case '${verb}': {`)
      writeRouterVerb(writer, trie, verb);
      writer.writeBlockEnd('}');
    }
  }

  writer
    .writeBlockEnd('}')
    .writeBlockEnd('}');

  writer
    .writeLines('')
    .writeBlockStart(`async function invokeRoute(route, url, request) {`);


  const errorRoute = routes.special[RoutableFileTypes.Error];
  if (errorRoute) {
    writer.writeBlockStart(`try {`);
  }

  writer.writeBlock(
    `if (route) {`, [
      `const [handler, params = {}, meta] = route;`,
      `const response = await handler({ request, url, params, meta, data: {} });`,
      `if (response) return response;`],
    `}`);


  const notFoundRoute = routes.special[RoutableFileTypes.NotFound];
  if (notFoundRoute) {
    writer
      .writeBlockStart(`if (request.headers.get('Accept')?.includes('text/html')) {`)
      .writeBlock(
        `return new Response(page$404.stream({ request, url, params: {} }), {`, [
            `status: 404,`,
            `headers: { "content-type": "text/html;charset=UTF-8" },`],
        `});`)
      .writeBlockEnd('}')
  }

  writer.writeLines(`return null;`);

  if (errorRoute) {
    writer.indent--;
    writer
      .writeBlockStart(`} catch (err) {`)
      .writeBlockStart(`if (request.headers.get('Accept')?.includes('text/html')) {`)
      .writeBlock(
        `return new Response(page$500.stream({ request, url, params: {}, error: err }), {`, [
            `status: 500,`,
            `headers: { "content-type": "text/html;charset=UTF-8" },`],
        `});`)
      .writeBlockEnd('}')
      .writeLines(`throw err;`)
      .writeBlockEnd('}');
  }

  writer.writeBlockEnd('}');

  writer.write(`
export function getMatchedRoute(method, url) {
  const route = matchRoute(method, url.pathname);
  if (route) {
    const [handler, params = {}, meta] = route;
    return {
      handler,
      params,
      meta,
      async invoke(request) {
        return await invokeRoute(route, url, request);
      }
    }
  }
  return null;
}

export async function router(request) {
  try {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname !== '/' && pathname.endsWith('/')) {
      url.pathname = pathname.replace(/\\/+$/, '');
      console.log('Redirecting to', url.href);
      return Response.redirect(url.href);
    }

    const route = matchRoute(request.method, pathname);
    return await invokeRoute(route, url, request) || new Response(null, {
      statusText: \`Not Found (No route matched \${pathname})\`,
      status: 404
    });
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

function writeRouterVerb(writer: Writer, trie: RouteTrie, verb: HttpVerb, level: number = 0, pathIndex: number = 0, useSwitch?: boolean): void {
  const { key, route: value, static: children, dynamic, catchAll } = trie;
  pathIndex += key.length;

  if (level <= 0) {
    level = 0;

    if (value) {
      writer.writeLines(`if (pathname === '/') return ${renderMatch(verb, value)}; // ${value.path}`)
    }
  
    if (children || dynamic) {
      writer.writeLines(
        `const segments = pathname.split('/');`,
        `const len = segments.length;`);
    }
  } else {
    if (!key) {
      writer.writeBlockStart(`if (segments[${level}]) {`);
    } else if (useSwitch) {
      writer.writeBlockStart(`case '${key}':`);
    } else {
      writer.writeBlockStart(`if (segments[${level}]?.toLowerCase() === '${key}') {`);
    }
    
    if (value) {
      writer.writeLines(`if (len === ${level + 1}) return ${renderMatch(verb, value)}; // ${value.path}`);
    }
  }

  if (children || dynamic) {
    if (children) {
      if (children.size > 1) {
        writer.writeBlockStart(`switch(segments[${level + 1}]?.toLowerCase()) {`);
        for (const child of children.values()) {
          writeRouterVerb(writer, child, verb, level + 1, pathIndex, true);
        }
        writer.writeBlockEnd('}');
      } else {
        for (const child of children.values()) {
          writeRouterVerb(writer, child, verb, level + 1, pathIndex);
        }
      }
    }

    if (dynamic) {
      writeRouterVerb(writer, dynamic, verb, level + 1, pathIndex);
    }
  }

  if (catchAll) {
    writer.writeLines(`return ${renderMatch(verb, catchAll, pathIndex)}; // ${catchAll.path}`);

    if (level > 0) {
      writer.indent--;
    }
  } else if (level === 0) {
    writer.writeLines('return;');
  } else if (useSwitch) {
    writer.writeLines('break;').indent--;
  } else {
    writer.writeBlockEnd('}');
  }
}


function renderParamsInfo(params: ParamInfo[], pathIndex?: number): string {
  let result = '';
  let catchAll = '';
  let dynamicLength = '';

  for (const { name, index } of params) {
    if (index >= 0) {
      result += result ? ', ' : '{ ';
      result += `'${name}': segments[${index + 1}]`;
      dynamicLength += ` + segments[${index + 1}].length`;
    } else if (pathIndex && pathIndex >= 0) {
      catchAll = name;
    }
  }

  if (catchAll) {
    result += result ? ', ' : '{ ';
    result += `'${catchAll}': pathname.slice(${pathIndex}${dynamicLength})`;
  } 

  return result ? result + ' }' : '{}';
}

function renderMatch(verb: HttpVerb, { index, params, meta }: Route, pathIndex?: number) {
  const tuple = [`${verb}$${index}`];
  if (params?.length) {
    tuple[1] = renderParamsInfo(params, pathIndex);
  }
  if (meta) {
    tuple[2] = `meta$${index}`;
  }
  return `[${tuple.join(', ')}]`;
}
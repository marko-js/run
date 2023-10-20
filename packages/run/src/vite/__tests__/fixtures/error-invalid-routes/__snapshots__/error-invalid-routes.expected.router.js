
// @marko/run/router
import { createContext } from 'virtual:marko-run/runtime/internal';
import errorPage from 'virtual:marko-run/__marko-run__error.marko?marko-server-entry';

const error = new Error(`Duplicate file type 'page' added at path '/$'. File '/$bar+page.marko' collides with '/$foo+page.marko'.`);
error.name = 'Error';
error.stack = `Error: Duplicate file type 'page' added at path '/$'. File '/$bar+page.marko' collides with '/$foo+page.marko'.
    at VDir.addFile (/Users/mirawlings/dev/marko-js/run/packages/run/src/vite/routes/vdir.ts:0:0)
    at onFile (/Users/mirawlings/dev/marko-js/run/packages/run/src/vite/routes/builder.ts:0:0)
    at walk (/Users/mirawlings/dev/marko-js/run/packages/run/src/vite/routes/walk.ts:0:0)
    at Object.walkFS (/Users/mirawlings/dev/marko-js/run/packages/run/src/vite/routes/walk.ts:0:0)
    at buildRoutes (/Users/mirawlings/dev/marko-js/run/packages/run/src/vite/routes/builder.ts:0:0)
    at Context.<anonymous> (/Users/mirawlings/dev/marko-js/run/packages/run/src/vite/__tests__/main.test.ts:0:0)`;

globalThis.__marko_run__ = { match, fetch, invoke };

export function match() {
  return { handler: errorPage, params: {}, meta: {}, path: '/*' }; // /$$
}

export async function invoke(route, request, platform, url) {
  const [context, buildInput] = createContext(route, request, platform, url);
  if (context.request.headers.get('Accept')?.includes('text/html')) {
    return new Response(errorPage.stream(buildInput({ error })), {
      status: 500,
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  }
  return new Response(error, {
    status: 500,
  });
}

export async function fetch(request, platform) {
  try {
    const url = new URL(request.url);
    let { pathname } = url;
    if (pathname !== '/' && pathname.endsWith('/')) {
      url.pathname = pathname.slice(0, -1);
      return Response.redirect(url);
    }   

    const route = match(request.method, pathname);
    return await invoke(route, request, platform, url);
  } catch (error) {
    if (import.meta.env.DEV) {
      let body;
      if (error.cause) {
        body = error.cause.stack || error.cause.message || error.cause;
      } else {
        body = error.stack || error.message || "Internal Server Error";
      }
      return new Response(body, {
        status: 500
      });
    }
    return new Response(null, {
      status: 500
    });
  }
}
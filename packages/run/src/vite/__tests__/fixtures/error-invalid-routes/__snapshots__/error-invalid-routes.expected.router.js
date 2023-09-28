
// @marko/run/router
import { createContext } from 'virtual:marko-run/runtime/internal';
import errorPage from 'virtual:marko-run/__marko-run__error.marko?marko-server-entry';

const error = new Error(`Duplicate file type 'page' added at path '/$'. File '/$bar+page.marko' collides with '/$foo+page.marko'.`);
error.name = 'Error';
error.stack = `Error: Duplicate file type 'page' added at path '/$'. File '/$bar+page.marko' collides with '/$foo+page.marko'.
    at VDir.addFile (/Users/rturnquist/dev/marko/run/packages/run/src/vite/routes/vdir.ts:0:0)
    at onFile (/Users/rturnquist/dev/marko/run/packages/run/src/vite/routes/builder.ts:0:0)
    at walk (/Users/rturnquist/dev/marko/run/packages/run/src/vite/routes/walk.ts:0:0)
    at walkFS (/Users/rturnquist/dev/marko/run/packages/run/src/vite/routes/walk.ts:0:0)
    at buildRoutes (/Users/rturnquist/dev/marko/run/packages/run/src/vite/routes/builder.ts:0:0)
    at Context.<anonymous> (/Users/rturnquist/dev/marko/run/packages/run/src/vite/__tests__/main.test.ts:0:0)`;

globalThis.__marko_run__ = { match, fetch, invoke };

export function match() {
  return { handler: errorPage, params: {}, meta: {}, path: '/*' }; // /$$
}

export async function invoke(route, request, platform, url) {
  const [context, buildInput] = createContext(route, request, platform, url);
  if (context.request.headers.get('Accept')?.includes('text/html')) {
    return new Response(errorPage.stream(buildInput({ error })), {
      status: 200,
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
    const body = import.meta.env.DEV
      ? error.stack || error.message || "Internal Server Error"
      : null;
    return new Response(body, {
      status: 500
    });
  }
}
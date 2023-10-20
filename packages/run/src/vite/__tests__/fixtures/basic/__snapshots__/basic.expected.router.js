// @marko/run/router
import { NotHandled, NotMatched, createContext } from 'virtual:marko-run/runtime/internal';
import { get1 } from 'virtual:marko-run/__marko-run__route.js';
import { get2 } from 'virtual:marko-run/__marko-run__route.fOoBaR.js';

globalThis.__marko_run__ = { match, fetch, invoke };
    
export function match(method, pathname) {
	if (!pathname) {
    pathname = '/';
  } else if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname;
  }
	switch (method) {
		case 'GET':
		case 'get': {
			const len = pathname.length;
			if (len === 1) return { handler: get1, params: {}, meta: {}, path: '/' }; // /
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				if (pathname.slice(1, i1 ? -1 : len) === 'fOoBaR') return { handler: get2, params: {}, meta: {}, path: '/fOoBaR' }; // /fOoBaR
			}
			return null;
		}
	}
	return null;
}

export async function invoke(route, request, platform, url) {
	const [context, buildInput] = createContext(route, request, platform, url);
	if (route) {
		try {
			const response = await route.handler(context, buildInput);
			if (response) return response;
		} catch (error) {
			if (error === NotHandled) return;
			if (error !== NotMatched) throw error;
		}
	}
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
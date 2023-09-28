// @marko/run/router
import { NotHandled, NotMatched, createContext } from 'virtual:marko-run/runtime/internal';
import { get1 } from 'virtual:marko-run/__marko-run__route.js';
import { get2 } from 'virtual:marko-run/__marko-run__route.foo.js';
import { get3 } from 'virtual:marko-run/__marko-run__route.$id.js';
import { get4 } from 'virtual:marko-run/__marko-run__route.$$rest.js';
import { get5 } from 'virtual:marko-run/__marko-run__route.a.c.js';
import { get6 } from 'virtual:marko-run/__marko-run__route.a.d.js';
import { get7 } from 'virtual:marko-run/__marko-run__route.b.c.js';
import { get8 } from 'virtual:marko-run/__marko-run__route.b.d.js';

globalThis.__marko_run__ = { match, fetch, invoke };
    
export function match(method, pathname) {
	if (!pathname) {
    pathname = '/';
  } else if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname;
  }
	switch (method.toLowerCase()) {
		case 'get': {
			const len = pathname.length;
			if (len === 1) return { handler: get1, params: {}, meta: {}, path: '/' }; // /
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
				if (s1.toLowerCase() === 'foo') return { handler: get2, params: {}, meta: {}, path: '/foo' }; // /foo
				if (s1) return { handler: get3, params: { id: s1 }, meta: {}, path: '/:id' }; // /$id
			} else {
				switch (decodeURIComponent(pathname.slice(1, i1 - 1)).toLowerCase()) {
					case 'a': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (decodeURIComponent(pathname.slice(3, i2 ? -1 : len)).toLowerCase()) {
								case 'c': return { handler: get5, params: {}, meta: {}, path: '/a/c' }; // /a/c
								case 'd': return { handler: get6, params: {}, meta: {}, path: '/a/d' }; // /a/d
							}
						}
					} break;
					case 'b': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (decodeURIComponent(pathname.slice(3, i2 ? -1 : len)).toLowerCase()) {
								case 'c': return { handler: get7, params: {}, meta: {}, path: '/b/c' }; // /b/c
								case 'd': return { handler: get8, params: {}, meta: {}, path: '/b/d' }; // /b/d
							}
						}
					} break;
				}
			}
			return { handler: get4, params: { rest: pathname.slice(1) }, meta: {}, path: '/:rest*' }; // /$$rest
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
    const body = import.meta.env.DEV
      ? error.stack || error.message || "Internal Server Error"
      : null;
    return new Response(body, {
      status: 500
    });
  }
}
// @marko/run/router
import { NotHandled, NotMatched, createContext } from 'virtual:marko-run/runtime/internal';
import { get1, head1 } from 'virtual:marko-run/__marko-run__route.e.f.js';
import { get2, head2 } from 'virtual:marko-run/__marko-run__route.a,b,c.$$id.e.html.js';
import { get3, head3 } from 'virtual:marko-run/__marko-run__route.g.h.js';

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
				if (pathname.slice(1, i1 ? -1 : len) === 'g.h') return { handler: get3, params: {}, meta: {}, path: '/g.h' }; // /g.h
			} else {
				if (pathname.slice(1, i1 - 1) === 'a,b,c') {
					const i2 = pathname.indexOf('/', 7) + 1;
					if (i2 && i2 !== len) {
						const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
						if (s2) {
							const i3 = pathname.indexOf('/', i2) + 1;
							if (!i3 || i3 === len) {
								if (pathname.slice(i2, i3 ? -1 : len) === 'e.html') return { handler: get2, params: { $id: s2 }, meta: {}, path: '/a,b,c/:id*/e.html' }; // /a,b,c/$$id/e.html
							}
						}
					}
				}
			}
			return null;
		}
		case 'HEAD':
		case 'head': {
			const len = pathname.length;
			if (len === 1) return { handler: head1, params: {}, meta: {}, path: '/' }; // /
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				if (pathname.slice(1, i1 ? -1 : len) === 'g.h') return { handler: head3, params: {}, meta: {}, path: '/g.h' }; // /g.h
			} else {
				if (pathname.slice(1, i1 - 1) === 'a,b,c') {
					const i2 = pathname.indexOf('/', 7) + 1;
					if (i2 && i2 !== len) {
						const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
						if (s2) {
							const i3 = pathname.indexOf('/', i2) + 1;
							if (!i3 || i3 === len) {
								if (pathname.slice(i2, i3 ? -1 : len) === 'e.html') return { handler: head2, params: { $id: s2 }, meta: {}, path: '/a,b,c/:id*/e.html' }; // /a,b,c/$$id/e.html
							}
						}
					}
				}
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

    return new Response(null, {
      status: 404,
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
      throw error;
    }
    return new Response(null, {
      status: 500
    });
  }
}
// @marko/run/router
import { NotHandled, NotMatched, createContext } from 'virtual:marko-run/runtime/internal';
import { get1, head1 } from 'virtual:marko-run/__marko-run__route.$foo.js';
import { get2, head2 } from 'virtual:marko-run/__marko-run__route.$foo.$bar.js';
import { get3, head3 } from 'virtual:marko-run/__marko-run__route.$foo.$$rest.js';
import { get4, head4 } from 'virtual:marko-run/__marko-run__route.$$rest.js';

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
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
					if (s1) return { handler: get1, params: { foo: s1 }, meta: {}, path: '/:foo' }; // /$foo
				} else {
					const s1 = decodeURIComponent(pathname.slice(1, i1 - 1));
					if (s1) {
						const i2 = pathname.indexOf('/', i1) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(i1, i2 ? -1 : len));
							if (s2) return { handler: get2, params: { foo: s1, bar: s2 }, meta: {}, path: '/:foo/:bar' }; // /$foo/$bar
						}
						return { handler: get3, params: { foo: s1, rest: pathname.slice(i1) }, meta: {}, path: '/:foo/:rest*' }; // /$foo/$$rest
					}
				}
			}
			return { handler: get4, params: { rest: pathname.slice(1) }, meta: {}, path: '/:rest*' }; // /$$rest
		}
		case 'HEAD':
		case 'head': {
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
					if (s1) return { handler: head1, params: { foo: s1 }, meta: {}, path: '/:foo' }; // /$foo
				} else {
					const s1 = decodeURIComponent(pathname.slice(1, i1 - 1));
					if (s1) {
						const i2 = pathname.indexOf('/', i1) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(i1, i2 ? -1 : len));
							if (s2) return { handler: head2, params: { foo: s1, bar: s2 }, meta: {}, path: '/:foo/:bar' }; // /$foo/$bar
						}
						return { handler: head3, params: { foo: s1, rest: pathname.slice(i1) }, meta: {}, path: '/:foo/:rest*' }; // /$foo/$$rest
					}
				}
			}
			return { handler: head4, params: { rest: pathname.slice(1) }, meta: {}, path: '/:rest*' }; // /$$rest
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
      throw error;
    }
    return new Response(null, {
      status: 500
    });
  }
}
// @marko/run/router
import { NotHandled, NotMatched, createContext } from 'virtual:marko-run/internal';
import { get1 } from 'virtual:marko-run/__marko-run__route.foo,_._,bar.,baz,.js';

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
				switch (decodeURIComponent(pathname.slice(1, i1 ? -1 : len)).toLowerCase()) {
					case 'foo': return { handler: get1, params: {}, meta: {}, path: '/foo' }; // /foo
					case 'bar': return { handler: get1, params: {}, meta: {}, path: '/bar' }; // /bar
					case 'baz': return { handler: get1, params: {}, meta: {}, path: '/baz' }; // /baz
				}
			} else {
				switch (decodeURIComponent(pathname.slice(1, i1 - 1)).toLowerCase()) {
					case 'foo': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							switch (decodeURIComponent(pathname.slice(5, i2 ? -1 : len)).toLowerCase()) {
								case 'bar': return { handler: get1, params: {}, meta: {}, path: '/foo/bar' }; // /foo/bar
								case 'baz': return { handler: get1, params: {}, meta: {}, path: '/foo/baz' }; // /foo/baz
							}
						} else {
							if (decodeURIComponent(pathname.slice(5, i2 - 1)).toLowerCase() === 'bar') {
								const i3 = pathname.indexOf('/', 9) + 1;
								if (!i3 || i3 === len) {
									if (decodeURIComponent(pathname.slice(9, i3 ? -1 : len)).toLowerCase() === 'baz') return { handler: get1, params: {}, meta: {}, path: '/foo/bar/baz' }; // /foo/bar/baz
								}
							}
						}
					} break;
					case 'bar': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							if (decodeURIComponent(pathname.slice(5, i2 ? -1 : len)).toLowerCase() === 'baz') return { handler: get1, params: {}, meta: {}, path: '/bar/baz' }; // /bar/baz
						}
					} break;
				}
			}
			return null;
		}
	}
	return null;
}

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
		}
	} catch (error) {
		throw error;
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
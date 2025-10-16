// @marko/run/router
import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, head1 } from "virtual:marko-run/__marko-run__index.js";
import { get2, head2 } from "virtual:marko-run/__marko-run__foo.js";
import { get3, head3 } from "virtual:marko-run/__marko-run__foo.bar.js";
import { get4, head4 } from "virtual:marko-run/__marko-run__foo.bar.baz.js";
import { get5, head5 } from "virtual:marko-run/__marko-run__foo.baz.js";
import { get6, head6 } from "virtual:marko-run/__marko-run__bar.js";
import { get7, head7 } from "virtual:marko-run/__marko-run__bar.baz.js";
import { get8, head8 } from "virtual:marko-run/__marko-run__baz.js";

globalThis.__marko_run__ = { match, fetch, invoke };
    
export function match(method, pathname) {
	const last = pathname.length - 1;
  return match_internal(method, last && pathname.charAt(last) === '/' ? pathname.slice(0, last) : pathname)
};
  
function match_internal(method, pathname) {
  const len = pathname.length;
	switch (method) {
		case 'GET':
		case 'get': {
			if (len === 1) return { handler: get1, params: {}, meta: {}, path: '/' };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'foo': return { handler: get2, params: {}, meta: {}, path: '/foo' };
					case 'bar': return { handler: get6, params: {}, meta: {}, path: '/bar' };
					case 'baz': return { handler: get8, params: {}, meta: {}, path: '/baz' };
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'foo': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(5, i2 ? -1 : len)) {
								case 'bar': return { handler: get3, params: {}, meta: {}, path: '/foo/bar' };
								case 'baz': return { handler: get5, params: {}, meta: {}, path: '/foo/baz' };
							}
						} else {
							if (pathname.slice(5, i2 - 1) === 'bar') {
								const i3 = pathname.indexOf('/', 9) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(9, i3 ? -1 : len) === 'baz') return { handler: get4, params: {}, meta: {}, path: '/foo/bar/baz' };
								}
							}
						}
					} break;
					case 'bar': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(5, i2 ? -1 : len) === 'baz') return { handler: get7, params: {}, meta: {}, path: '/bar/baz' };
						}
					} break;
				}
			}
			return null;
		}
		case 'HEAD':
		case 'head': {
			if (len === 1) return { handler: head1, params: {}, meta: {}, path: '/' };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'foo': return { handler: head2, params: {}, meta: {}, path: '/foo' };
					case 'bar': return { handler: head6, params: {}, meta: {}, path: '/bar' };
					case 'baz': return { handler: head8, params: {}, meta: {}, path: '/baz' };
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'foo': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(5, i2 ? -1 : len)) {
								case 'bar': return { handler: head3, params: {}, meta: {}, path: '/foo/bar' };
								case 'baz': return { handler: head5, params: {}, meta: {}, path: '/foo/baz' };
							}
						} else {
							if (pathname.slice(5, i2 - 1) === 'bar') {
								const i3 = pathname.indexOf('/', 9) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(9, i3 ? -1 : len) === 'baz') return { handler: head4, params: {}, meta: {}, path: '/foo/bar/baz' };
								}
							}
						}
					} break;
					case 'bar': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(5, i2 ? -1 : len) === 'baz') return { handler: head7, params: {}, meta: {}, path: '/bar/baz' };
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
	const context = createContext(route, request, platform, url);
	if (route) {
		try {
			const response = await route.handler(context);
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
    const { pathname } = url;
    const last = pathname.length - 1;
    const hasTrailingSlash = last && pathname.charAt(last) === '/';
    const normalizedPathname = hasTrailingSlash ? pathname.slice(0, last) : pathname;
    const route = match_internal(request.method, normalizedPathname);
    if (route && hasTrailingSlash) {
      url.pathname = normalizedPathname
      return Response.redirect(url);
    }   
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
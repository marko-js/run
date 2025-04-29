// @marko/run/router
import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, head1 } from "virtual:marko-run/__marko-run__a%3fb.$.$.route.js";
import { get2, head2 } from "virtual:marko-run/__marko-run__a%3fb.baz.route.js";

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
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (decodeURIComponent(pathname.slice(1, i1 - 1)) === 'a?b') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(7, i2 ? -1 : len) === 'baz') return { handler: get2, params: {}, meta: {}, path: '/a%3fb/baz' };
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									const s3 = decodeURIComponent(pathname.slice(i2, i3 ? -1 : len));
									if (s3) return { handler: get1, params: { $id: s2, foo: s3 }, meta: {}, path: '/a%3fb/$`$id`/$foo' };
								}
							}
						}
					}
				}
			}
			return null;
		}
		case 'HEAD':
		case 'head': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (decodeURIComponent(pathname.slice(1, i1 - 1)) === 'a?b') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(7, i2 ? -1 : len) === 'baz') return { handler: head2, params: {}, meta: {}, path: '/a%3fb/baz' };
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									const s3 = decodeURIComponent(pathname.slice(i2, i3 ? -1 : len));
									if (s3) return { handler: head1, params: { $id: s2, foo: s3 }, meta: {}, path: '/a%3fb/$`$id`/$foo' };
								}
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
import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, head1 } from "virtual:marko-run/__marko-run__index.js";
import { get2, head2, post2 } from "virtual:marko-run/__marko-run__foo.js";
import { get3, head3 } from "virtual:marko-run/__marko-run__$.js";
import { get4, head4 } from "virtual:marko-run/__marko-run__$$.js";
import { get5, head5, post5 } from "virtual:marko-run/__marko-run__a.c.js";
import { get6, head6, post6 } from "virtual:marko-run/__marko-run__a.d.js";
import { get7, head7, post7 } from "virtual:marko-run/__marko-run__b.c.js";
import { get8, head8, post8 } from "virtual:marko-run/__marko-run__b.d.js";

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
				const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
				if (s1 === 'foo') return { handler: get2, params: {}, meta: {}, path: '/foo' };
				if (s1) return { handler: get3, params: { id: s1 }, meta: {}, path: '/$id' };
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'a': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(3, i2 ? -1 : len)) {
								case 'c': return { handler: get5, params: {}, meta: {}, path: '/a/c' };
								case 'd': return { handler: get6, params: {}, meta: {}, path: '/a/d' };
							}
						}
					} break;
					case 'b': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(3, i2 ? -1 : len)) {
								case 'c': return { handler: get7, params: {}, meta: {}, path: '/b/c' };
								case 'd': return { handler: get8, params: {}, meta: {}, path: '/b/d' };
							}
						}
					} break;
				}
			}
			return { handler: get4, params: { rest: pathname.slice(1) }, meta: {}, path: '/$$rest' };
		}
		case 'HEAD':
		case 'head': {
			if (len === 1) return { handler: head1, params: {}, meta: {}, path: '/' };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
				if (s1 === 'foo') return { handler: head2, params: {}, meta: {}, path: '/foo' };
				if (s1) return { handler: head3, params: { id: s1 }, meta: {}, path: '/$id' };
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'a': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(3, i2 ? -1 : len)) {
								case 'c': return { handler: head5, params: {}, meta: {}, path: '/a/c' };
								case 'd': return { handler: head6, params: {}, meta: {}, path: '/a/d' };
							}
						}
					} break;
					case 'b': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(3, i2 ? -1 : len)) {
								case 'c': return { handler: head7, params: {}, meta: {}, path: '/b/c' };
								case 'd': return { handler: head8, params: {}, meta: {}, path: '/b/d' };
							}
						}
					} break;
				}
			}
			return { handler: head4, params: { rest: pathname.slice(1) }, meta: {}, path: '/$$rest' };
		}
		case 'POST':
		case 'post': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					if (pathname.slice(1, i1 ? -1 : len) === 'foo') return { handler: post2, params: {}, meta: {}, path: '/foo' };
				} else {
					switch (pathname.slice(1, i1 - 1)) {
						case 'a': {
							const i2 = pathname.indexOf('/', 3) + 1;
							if (!i2 || i2 === len) {
								switch (pathname.slice(3, i2 ? -1 : len)) {
									case 'c': return { handler: post5, params: {}, meta: {}, path: '/a/c' };
									case 'd': return { handler: post6, params: {}, meta: {}, path: '/a/d' };
								}
							}
						} break;
						case 'b': {
							const i2 = pathname.indexOf('/', 3) + 1;
							if (!i2 || i2 === len) {
								switch (pathname.slice(3, i2 ? -1 : len)) {
									case 'c': return { handler: post7, params: {}, meta: {}, path: '/b/c' };
									case 'd': return { handler: post8, params: {}, meta: {}, path: '/b/d' };
								}
							}
						} break;
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
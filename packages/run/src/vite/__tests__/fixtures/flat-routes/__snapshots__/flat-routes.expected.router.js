import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, get1_options, head1, head1_options } from "virtual:marko-run/__marko-run__index.js";
import { get2, get2_options, head2, head2_options, post2, post2_options } from "virtual:marko-run/__marko-run__foo.js";
import { get3, get3_options, head3, head3_options } from "virtual:marko-run/__marko-run__$.js";
import { get4, get4_options, head4, head4_options } from "virtual:marko-run/__marko-run__$$.js";
import { get5, get5_options, head5, head5_options, post5, post5_options } from "virtual:marko-run/__marko-run__a.c.js";
import { get6, get6_options, head6, head6_options, post6, post6_options } from "virtual:marko-run/__marko-run__a.d.js";
import { get7, get7_options, head7, head7_options, post7, post7_options } from "virtual:marko-run/__marko-run__b.c.js";
import { get8, get8_options, head8, head8_options, post8, post8_options } from "virtual:marko-run/__marko-run__b.d.js";

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
			if (len === 1) return { handler: get1, path: '/', params: {}, options: get1_options, meta: {} };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
				if (s1 === 'foo') return { handler: get2, path: '/foo', params: {}, options: get2_options, meta: {} };
				if (s1) return { handler: get3, path: '/$id', params: { id: s1 }, options: get3_options, meta: {} };
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'a': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(3, i2 ? -1 : len)) {
								case 'c': return { handler: get5, path: '/a/c', params: {}, options: get5_options, meta: {} };
								case 'd': return { handler: get6, path: '/a/d', params: {}, options: get6_options, meta: {} };
							}
						}
					} break;
					case 'b': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(3, i2 ? -1 : len)) {
								case 'c': return { handler: get7, path: '/b/c', params: {}, options: get7_options, meta: {} };
								case 'd': return { handler: get8, path: '/b/d', params: {}, options: get8_options, meta: {} };
							}
						}
					} break;
				}
			}
			return { handler: get4, path: '/$$rest', params: { rest: pathname.slice(1) }, options: get4_options, meta: {} };
		}
		case 'HEAD':
		case 'head': {
			if (len === 1) return { handler: head1, path: '/', params: {}, options: head1_options, meta: {} };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
				if (s1 === 'foo') return { handler: head2, path: '/foo', params: {}, options: head2_options, meta: {} };
				if (s1) return { handler: head3, path: '/$id', params: { id: s1 }, options: head3_options, meta: {} };
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'a': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(3, i2 ? -1 : len)) {
								case 'c': return { handler: head5, path: '/a/c', params: {}, options: head5_options, meta: {} };
								case 'd': return { handler: head6, path: '/a/d', params: {}, options: head6_options, meta: {} };
							}
						}
					} break;
					case 'b': {
						const i2 = pathname.indexOf('/', 3) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(3, i2 ? -1 : len)) {
								case 'c': return { handler: head7, path: '/b/c', params: {}, options: head7_options, meta: {} };
								case 'd': return { handler: head8, path: '/b/d', params: {}, options: head8_options, meta: {} };
							}
						}
					} break;
				}
			}
			return { handler: head4, path: '/$$rest', params: { rest: pathname.slice(1) }, options: head4_options, meta: {} };
		}
		case 'POST':
		case 'post': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					if (pathname.slice(1, i1 ? -1 : len) === 'foo') return { handler: post2, path: '/foo', params: {}, options: post2_options, meta: {} };
				} else {
					switch (pathname.slice(1, i1 - 1)) {
						case 'a': {
							const i2 = pathname.indexOf('/', 3) + 1;
							if (!i2 || i2 === len) {
								switch (pathname.slice(3, i2 ? -1 : len)) {
									case 'c': return { handler: post5, path: '/a/c', params: {}, options: post5_options, meta: {} };
									case 'd': return { handler: post6, path: '/a/d', params: {}, options: post6_options, meta: {} };
								}
							}
						} break;
						case 'b': {
							const i2 = pathname.indexOf('/', 3) + 1;
							if (!i2 || i2 === len) {
								switch (pathname.slice(3, i2 ? -1 : len)) {
									case 'c': return { handler: post7, path: '/b/c', params: {}, options: post7_options, meta: {} };
									case 'd': return { handler: post8, path: '/b/d', params: {}, options: post8_options, meta: {} };
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
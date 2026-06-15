import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, get1_options, head1, head1_options } from "virtual:marko-run/__marko-run__index.js";
import { get2, get2_options, head2, head2_options } from "virtual:marko-run/__marko-run__foo.js";
import { get3, get3_options, head3, head3_options } from "virtual:marko-run/__marko-run__foo.bar.js";
import { get4, get4_options, head4, head4_options } from "virtual:marko-run/__marko-run__foo.bar.baz.js";
import { get5, get5_options, head5, head5_options } from "virtual:marko-run/__marko-run__foo.baz.js";
import { get6, get6_options, head6, head6_options } from "virtual:marko-run/__marko-run__bar.js";
import { get7, get7_options, head7, head7_options } from "virtual:marko-run/__marko-run__bar.baz.js";
import { get8, get8_options, head8, head8_options } from "virtual:marko-run/__marko-run__baz.js";

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
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'foo': return { handler: get2, path: '/foo', params: {}, options: get2_options, meta: {} };
					case 'bar': return { handler: get6, path: '/bar', params: {}, options: get6_options, meta: {} };
					case 'baz': return { handler: get8, path: '/baz', params: {}, options: get8_options, meta: {} };
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'foo': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(5, i2 ? -1 : len)) {
								case 'bar': return { handler: get3, path: '/foo/bar', params: {}, options: get3_options, meta: {} };
								case 'baz': return { handler: get5, path: '/foo/baz', params: {}, options: get5_options, meta: {} };
							}
						} else {
							if (pathname.slice(5, i2 - 1) === 'bar') {
								const i3 = pathname.indexOf('/', 9) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(9, i3 ? -1 : len) === 'baz') return { handler: get4, path: '/foo/bar/baz', params: {}, options: get4_options, meta: {} };
								}
							}
						}
					} break;
					case 'bar': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(5, i2 ? -1 : len) === 'baz') return { handler: get7, path: '/bar/baz', params: {}, options: get7_options, meta: {} };
						}
					} break;
				}
			}
			return null;
		}
		case 'HEAD':
		case 'head': {
			if (len === 1) return { handler: head1, path: '/', params: {}, options: head1_options, meta: {} };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'foo': return { handler: head2, path: '/foo', params: {}, options: head2_options, meta: {} };
					case 'bar': return { handler: head6, path: '/bar', params: {}, options: head6_options, meta: {} };
					case 'baz': return { handler: head8, path: '/baz', params: {}, options: head8_options, meta: {} };
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'foo': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(5, i2 ? -1 : len)) {
								case 'bar': return { handler: head3, path: '/foo/bar', params: {}, options: head3_options, meta: {} };
								case 'baz': return { handler: head5, path: '/foo/baz', params: {}, options: head5_options, meta: {} };
							}
						} else {
							if (pathname.slice(5, i2 - 1) === 'bar') {
								const i3 = pathname.indexOf('/', 9) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(9, i3 ? -1 : len) === 'baz') return { handler: head4, path: '/foo/bar/baz', params: {}, options: head4_options, meta: {} };
								}
							}
						}
					} break;
					case 'bar': {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(5, i2 ? -1 : len) === 'baz') return { handler: head7, path: '/bar/baz', params: {}, options: head7_options, meta: {} };
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
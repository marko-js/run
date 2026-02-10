import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { post1, post1_meta, put1, put1_meta, delete1, delete1_meta } from "virtual:marko-run/__marko-run__foo.bar.js";
import { get2, get2_meta, head2, head2_meta, post2, post2_meta, put2, put2_meta, delete2, delete2_meta } from "virtual:marko-run/__marko-run__foo.baz.js";

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
					if (pathname.slice(1, i1 - 1) === 'foo') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(5, i2 ? -1 : len) === 'baz') return { handler: get2, params: {}, meta: get2_meta, path: '/foo/baz' };
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
					if (pathname.slice(1, i1 - 1) === 'foo') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(5, i2 ? -1 : len) === 'baz') return { handler: head2, params: {}, meta: head2_meta, path: '/foo/baz' };
						}
					}
				}
			}
			return null;
		}
		case 'POST':
		case 'post': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === 'foo') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(5, i2 ? -1 : len)) {
								case 'bar': return { handler: post1, params: {}, meta: post1_meta, path: '/foo/bar' };
								case 'baz': return { handler: post2, params: {}, meta: post2_meta, path: '/foo/baz' };
							}
						}
					}
				}
			}
			return null;
		}
		case 'PUT':
		case 'put': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === 'foo') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(5, i2 ? -1 : len)) {
								case 'bar': return { handler: put1, params: {}, meta: put1_meta, path: '/foo/bar' };
								case 'baz': return { handler: put2, params: {}, meta: put2_meta, path: '/foo/baz' };
							}
						}
					}
				}
			}
			return null;
		}
		case 'DELETE':
		case 'delete': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === 'foo') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							switch (pathname.slice(5, i2 ? -1 : len)) {
								case 'bar': return { handler: delete1, params: {}, meta: delete1_meta, path: '/foo/bar' };
								case 'baz': return { handler: delete2, params: {}, meta: delete2_meta, path: '/foo/baz' };
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
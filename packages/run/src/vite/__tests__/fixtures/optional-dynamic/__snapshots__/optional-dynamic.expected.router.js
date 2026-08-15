import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, get1_options, head1, head1_options, query1, query1_options } from "virtual:marko-run/__marko-run__$.$.js";
import { get2, get2_options, head2, head2_options, query2, query2_options } from "virtual:marko-run/__marko-run__$.$$.js";
import { get3, get3_options, head3, head3_options, query3, query3_options } from "virtual:marko-run/__marko-run__$.js";
import { get4, get4_options, head4, head4_options, query4, query4_options } from "virtual:marko-run/__marko-run__$$.js";

globalThis.__marko_run__ = { match, fetch, invoke };
    
export function match(method, pathname) {
	return match_internal(method, pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname)
};
  
function match_internal(method, pathname) {
  const len = pathname.length;
	switch (method) {
		case 'GET':
		case 'get': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
					if (s1) return { handler: get3, path: "/$bar", params: { bar: s1 }, options: get3_options, meta: {} };
				} else {
					const s1 = decodeURIComponent(pathname.slice(1, i1 - 1));
					if (s1) {
						const i2 = pathname.indexOf('/', i1) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(i1, i2 ? -1 : len));
							if (s2) return { handler: get1, path: "/$foo/$bar", params: { foo: s1, bar: s2 }, options: get1_options, meta: {} };
						}
						return { handler: get2, path: "/$foo/$$rest", params: { foo: s1, rest: decodeURIComponent(pathname.slice(i1)) }, options: get2_options, meta: {} };
					}
				}
			}
			return { handler: get4, path: "/$$rest", params: { rest: decodeURIComponent(pathname.slice(1)) }, options: get4_options, meta: {} };
		}
		case 'HEAD':
		case 'head': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
					if (s1) return { handler: head3, path: "/$bar", params: { bar: s1 }, options: head3_options, meta: {} };
				} else {
					const s1 = decodeURIComponent(pathname.slice(1, i1 - 1));
					if (s1) {
						const i2 = pathname.indexOf('/', i1) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(i1, i2 ? -1 : len));
							if (s2) return { handler: head1, path: "/$foo/$bar", params: { foo: s1, bar: s2 }, options: head1_options, meta: {} };
						}
						return { handler: head2, path: "/$foo/$$rest", params: { foo: s1, rest: decodeURIComponent(pathname.slice(i1)) }, options: head2_options, meta: {} };
					}
				}
			}
			return { handler: head4, path: "/$$rest", params: { rest: decodeURIComponent(pathname.slice(1)) }, options: head4_options, meta: {} };
		}
		case 'QUERY':
		case 'query': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
					if (s1) return { handler: query3, path: "/$bar", params: { bar: s1 }, options: query3_options, meta: {} };
				} else {
					const s1 = decodeURIComponent(pathname.slice(1, i1 - 1));
					if (s1) {
						const i2 = pathname.indexOf('/', i1) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(i1, i2 ? -1 : len));
							if (s2) return { handler: query1, path: "/$foo/$bar", params: { foo: s1, bar: s2 }, options: query1_options, meta: {} };
						}
						return { handler: query2, path: "/$foo/$$rest", params: { foo: s1, rest: decodeURIComponent(pathname.slice(i1)) }, options: query2_options, meta: {} };
					}
				}
			}
			return { handler: query4, path: "/$$rest", params: { rest: decodeURIComponent(pathname.slice(1)) }, options: query4_options, meta: {} };
		}
	}
	return null;
}

export async function invoke(route, request, platform, url) {
	if (route) {
		url ??= new URL(request.url);
		const { pathname } = url;
		if (pathname.length > 1 && pathname.endsWith('/')) {
			url.pathname = pathname.slice(0, -1);
			return Response.redirect(url);
		}
	}
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
    const route = match_internal(request.method, pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname);
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
import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get3, get3_options, head3, head3_options } from "virtual:marko-run/__marko-run__index.js";
import { get4, get4_options, head4, head4_options } from "virtual:marko-run/__marko-run__a.js";
import { get5, get5_options, head5, head5_options } from "virtual:marko-run/__marko-run__b.js";
import { get6, get6_options, head6, head6_options } from "virtual:marko-run/__marko-run__flat.page.js";
import { get7, get7_options, head7, head7_options } from "virtual:marko-run/__marko-run__docs.js";
import { get8, get8_options, head8, head8_options } from "virtual:marko-run/__marko-run__docs.$.js";
import { get9, get9_options, head9, head9_options, post9, post9_options, put9, put9_options, delete9, delete9_options, patch9, patch9_options, options9, options9_options, query9, query9_options } from "virtual:marko-run/__marko-run__blog.js";
import page404 from "./dist/.marko-run/404.marko";
import page500 from "./dist/.marko-run/500.marko";

globalThis.__marko_run__ = { match, fetch, invoke };
    
export function match(method, pathname) {
	return match_internal(method, pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname)
};

function match_internal(method, pathname) {
  const len = pathname.length;
	try {
		switch (method) {
			case 'GET':
			case 'get': {
				if (len === 1) return { handler: get3, path: "/", params: {}, options: get3_options, meta: {} };
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					switch (pathname.slice(1, i1 ? -1 : len)) {
						case "a": return { handler: get4, path: "/a", params: {}, options: get4_options, meta: {} };
						case "b": return { handler: get5, path: "/b", params: {}, options: get5_options, meta: {} };
						case "docs": return { handler: get7, path: "/docs", params: {}, options: get7_options, meta: {} };
						case "blog": return { handler: get9, path: "/blog", params: {}, options: get9_options, meta: {} };
					}
				} else {
					switch (pathname.slice(1, i1 - 1)) {
						case "flat": {
							const i2 = pathname.indexOf('/', 6) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(6, i2 ? -1 : len) === "page") return { handler: get6, path: "/flat/page", params: {}, options: get6_options, meta: {} };
							}
						} break;
						case "docs": {
							const i2 = pathname.indexOf('/', 6) + 1;
							if (!i2 || i2 === len) {
								const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
								if (s2) return { handler: get8, path: "/docs/$slug", params: { slug: s2 }, options: get8_options, meta: {} };
							}
						} break;
					}
				}
				return null;
			}
			case 'HEAD':
			case 'head': {
				if (len === 1) return { handler: head3, path: "/", params: {}, options: head3_options, meta: {} };
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					switch (pathname.slice(1, i1 ? -1 : len)) {
						case "a": return { handler: head4, path: "/a", params: {}, options: head4_options, meta: {} };
						case "b": return { handler: head5, path: "/b", params: {}, options: head5_options, meta: {} };
						case "docs": return { handler: head7, path: "/docs", params: {}, options: head7_options, meta: {} };
						case "blog": return { handler: head9, path: "/blog", params: {}, options: head9_options, meta: {} };
					}
				} else {
					switch (pathname.slice(1, i1 - 1)) {
						case "flat": {
							const i2 = pathname.indexOf('/', 6) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(6, i2 ? -1 : len) === "page") return { handler: head6, path: "/flat/page", params: {}, options: head6_options, meta: {} };
							}
						} break;
						case "docs": {
							const i2 = pathname.indexOf('/', 6) + 1;
							if (!i2 || i2 === len) {
								const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
								if (s2) return { handler: head8, path: "/docs/$slug", params: { slug: s2 }, options: head8_options, meta: {} };
							}
						} break;
					}
				}
				return null;
			}
			case 'POST':
			case 'post': {
				if (len > 1) {
					const i1 = pathname.indexOf('/', 1) + 1;
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "blog") return { handler: post9, path: "/blog", params: {}, options: post9_options, meta: {} };
					}
				}
				return null;
			}
			case 'PUT':
			case 'put': {
				if (len > 1) {
					const i1 = pathname.indexOf('/', 1) + 1;
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "blog") return { handler: put9, path: "/blog", params: {}, options: put9_options, meta: {} };
					}
				}
				return null;
			}
			case 'DELETE':
			case 'delete': {
				if (len > 1) {
					const i1 = pathname.indexOf('/', 1) + 1;
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "blog") return { handler: delete9, path: "/blog", params: {}, options: delete9_options, meta: {} };
					}
				}
				return null;
			}
			case 'PATCH':
			case 'patch': {
				if (len > 1) {
					const i1 = pathname.indexOf('/', 1) + 1;
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "blog") return { handler: patch9, path: "/blog", params: {}, options: patch9_options, meta: {} };
					}
				}
				return null;
			}
			case 'OPTIONS':
			case 'options': {
				if (len > 1) {
					const i1 = pathname.indexOf('/', 1) + 1;
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "blog") return { handler: options9, path: "/blog", params: {}, options: options9_options, meta: {} };
					}
				}
				return null;
			}
			case 'QUERY':
			case 'query': {
				if (len > 1) {
					const i1 = pathname.indexOf('/', 1) + 1;
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "blog") return { handler: query9, path: "/blog", params: {}, options: query9_options, meta: {} };
					}
				}
				return null;
			}
		}
	} catch (error) {
		// A malformed percent-escape is an invalid URI: no route can match it.
		if (error instanceof URIError) return null;
		throw error;
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
	try {
		if (route) {
			try {
				const response = await route.handler(context);
				if (response) return response;
			} catch (error) {
				if (error === NotHandled) return;
				if (error !== NotMatched) throw error;
			}
		}

    if (context.request.headers.get('Accept')?.includes('text/html')) {
      return context.render(page404, {}, { status: 404 });
    }	
    return new Response(null, {
      status: 404,
    });
	} catch (error) {
		if (context.request.headers.get('Accept')?.includes('text/html')) {
			return context.render(page500, { error }, { status: 500 });
		}
		throw error;
	}
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
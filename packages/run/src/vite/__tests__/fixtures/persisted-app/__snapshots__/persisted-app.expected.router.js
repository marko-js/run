import { NotHandled, NotMatched, createContext, usePersisted, acceptsPatch } from "virtual:marko-run/runtime/internal";
usePersisted();
import { get3, get3_options, head3, head3_options } from "virtual:marko-run/__marko-run__index.js";
import { get4, get4_options, head4, head4_options, post4, post4_options, put4, put4_options, delete4, delete4_options, patch4, patch4_options, options4, options4_options, query4, query4_options } from "virtual:marko-run/__marko-run__api.js";
import { get5, get5_options, head5, head5_options } from "virtual:marko-run/__marko-run__blog.js";
import { get6, get6_options, head6, head6_options } from "virtual:marko-run/__marko-run__blog.$.js";
import { get7, get7_options, head7, head7_options } from "virtual:marko-run/__marko-run__blog.tag.$$.js";
import { get8, get8_options, head8, head8_options } from "virtual:marko-run/__marko-run__about.js";
import { get9, get9_options, head9, head9_options, post9, post9_options, put9, put9_options, delete9, delete9_options, patch9, patch9_options, options9, options9_options, query9, query9_options } from "virtual:marko-run/__marko-run__admin.users.js";
import page404 from "./dist/.marko-run/__marko-run__app.marko";
import page500 from "./dist/.marko-run/__marko-run__app.marko";

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
						case "api": return { handler: get4, path: "/api", params: {}, options: get4_options, meta: {} };
						case "blog": return { handler: get5, path: "/blog", params: {}, options: get5_options, meta: {} };
						case "about": return { handler: get8, path: "/about", params: {}, options: get8_options, meta: {} };
					}
				} else {
					switch (pathname.slice(1, i1 - 1)) {
						case "blog": {
							const i2 = pathname.indexOf('/', 6) + 1;
							if (!i2 || i2 === len) {
								const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
								if (s2) return { handler: get6, path: "/blog/$slug", params: { slug: s2 }, options: get6_options, meta: {} };
							} else {
								if (pathname.slice(6, i2 - 1) === "tag") {
									return { handler: get7, path: "/blog/tag/$$", params: {}, options: get7_options, meta: {} };
								}
							}
						} break;
						case "admin": {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: get9, path: "/admin/users", params: {}, options: get9_options, meta: {} };
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
						case "api": return { handler: head4, path: "/api", params: {}, options: head4_options, meta: {} };
						case "blog": return { handler: head5, path: "/blog", params: {}, options: head5_options, meta: {} };
						case "about": return { handler: head8, path: "/about", params: {}, options: head8_options, meta: {} };
					}
				} else {
					switch (pathname.slice(1, i1 - 1)) {
						case "blog": {
							const i2 = pathname.indexOf('/', 6) + 1;
							if (!i2 || i2 === len) {
								const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
								if (s2) return { handler: head6, path: "/blog/$slug", params: { slug: s2 }, options: head6_options, meta: {} };
							} else {
								if (pathname.slice(6, i2 - 1) === "tag") {
									return { handler: head7, path: "/blog/tag/$$", params: {}, options: head7_options, meta: {} };
								}
							}
						} break;
						case "admin": {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: head9, path: "/admin/users", params: {}, options: head9_options, meta: {} };
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
						if (pathname.slice(1, i1 ? -1 : len) === "api") return { handler: post4, path: "/api", params: {}, options: post4_options, meta: {} };
					} else {
						if (pathname.slice(1, i1 - 1) === "admin") {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: post9, path: "/admin/users", params: {}, options: post9_options, meta: {} };
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
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "api") return { handler: put4, path: "/api", params: {}, options: put4_options, meta: {} };
					} else {
						if (pathname.slice(1, i1 - 1) === "admin") {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: put9, path: "/admin/users", params: {}, options: put9_options, meta: {} };
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
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "api") return { handler: delete4, path: "/api", params: {}, options: delete4_options, meta: {} };
					} else {
						if (pathname.slice(1, i1 - 1) === "admin") {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: delete9, path: "/admin/users", params: {}, options: delete9_options, meta: {} };
							}
						}
					}
				}
				return null;
			}
			case 'PATCH':
			case 'patch': {
				if (len > 1) {
					const i1 = pathname.indexOf('/', 1) + 1;
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "api") return { handler: patch4, path: "/api", params: {}, options: patch4_options, meta: {} };
					} else {
						if (pathname.slice(1, i1 - 1) === "admin") {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: patch9, path: "/admin/users", params: {}, options: patch9_options, meta: {} };
							}
						}
					}
				}
				return null;
			}
			case 'OPTIONS':
			case 'options': {
				if (len > 1) {
					const i1 = pathname.indexOf('/', 1) + 1;
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "api") return { handler: options4, path: "/api", params: {}, options: options4_options, meta: {} };
					} else {
						if (pathname.slice(1, i1 - 1) === "admin") {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: options9, path: "/admin/users", params: {}, options: options9_options, meta: {} };
							}
						}
					}
				}
				return null;
			}
			case 'QUERY':
			case 'query': {
				if (len > 1) {
					const i1 = pathname.indexOf('/', 1) + 1;
					if (!i1 || i1 === len) {
						if (pathname.slice(1, i1 ? -1 : len) === "api") return { handler: query4, path: "/api", params: {}, options: query4_options, meta: {} };
					} else {
						if (pathname.slice(1, i1 - 1) === "admin") {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: query9, path: "/admin/users", params: {}, options: query9_options, meta: {} };
							}
						}
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

    if (context.request.headers.get('Accept')?.includes('text/html') || acceptsPatch(context.request)) {
      return context.render(page404, { page: 2 }, { status: 404 });
    }	
    return new Response(null, {
      status: 404,
    });
	} catch (error) {
		if (context.request.headers.get('Accept')?.includes('text/html') || acceptsPatch(context.request)) {
			return context.render(page500, { page: 3, error }, { status: 500 });
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
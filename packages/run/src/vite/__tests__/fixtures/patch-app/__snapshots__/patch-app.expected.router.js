import { NotHandled, NotMatched, createContext, patchResponse, unmarkedRequest } from "virtual:marko-run/runtime/internal";
import { patchRequest, patchResponseHeaders } from "@marko/vite/patch";
import patchApp from "./dist/.marko-run/__marko-run__app.marko";
import { get3, get3_options, head3, head3_options } from "virtual:marko-run/__marko-run__index.js";
import { get4, get4_options, head4, head4_options, post4, post4_options, put4, put4_options, delete4, delete4_options, patch4, patch4_options, options4, options4_options, query4, query4_options } from "virtual:marko-run/__marko-run__api.js";
import { post5, post5_options } from "virtual:marko-run/__marko-run__api.events.js";
import { put6, put6_options, delete6, delete6_options } from "virtual:marko-run/__marko-run__api.items.js";
import { patch7, patch7_options } from "virtual:marko-run/__marko-run__api.items.$.js";
import { get8, get8_options, head8, head8_options } from "virtual:marko-run/__marko-run__blog.js";
import { get9, get9_options, head9, head9_options } from "virtual:marko-run/__marko-run__blog.$.js";
import { get10, get10_options, head10, head10_options } from "virtual:marko-run/__marko-run__blog.tag.$$.js";
import { get11, get11_options, head11, head11_options } from "virtual:marko-run/__marko-run__about.js";
import { get12, get12_options, head12, head12_options, post12, post12_options, put12, put12_options, delete12, delete12_options, patch12, patch12_options, options12, options12_options, query12, query12_options } from "virtual:marko-run/__marko-run__admin.users.js";
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
						case "blog": return { handler: get8, path: "/blog", params: {}, options: get8_options, meta: {} };
						case "about": return { handler: get11, path: "/about", params: {}, options: get11_options, meta: {} };
					}
				} else {
					switch (pathname.slice(1, i1 - 1)) {
						case "blog": {
							const i2 = pathname.indexOf('/', 6) + 1;
							if (!i2 || i2 === len) {
								const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
								if (s2) return { handler: get9, path: "/blog/$slug", params: { slug: s2 }, options: get9_options, meta: {} };
							} else {
								if (pathname.slice(6, i2 - 1) === "tag") {
									return { handler: get10, path: "/blog/tag/$$", params: {}, options: get10_options, meta: {} };
								}
							}
						} break;
						case "admin": {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: get12, path: "/admin/users", params: {}, options: get12_options, meta: {} };
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
						case "blog": return { handler: head8, path: "/blog", params: {}, options: head8_options, meta: {} };
						case "about": return { handler: head11, path: "/about", params: {}, options: head11_options, meta: {} };
					}
				} else {
					switch (pathname.slice(1, i1 - 1)) {
						case "blog": {
							const i2 = pathname.indexOf('/', 6) + 1;
							if (!i2 || i2 === len) {
								const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
								if (s2) return { handler: head9, path: "/blog/$slug", params: { slug: s2 }, options: head9_options, meta: {} };
							} else {
								if (pathname.slice(6, i2 - 1) === "tag") {
									return { handler: head10, path: "/blog/tag/$$", params: {}, options: head10_options, meta: {} };
								}
							}
						} break;
						case "admin": {
							const i2 = pathname.indexOf('/', 7) + 1;
							if (!i2 || i2 === len) {
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: head12, path: "/admin/users", params: {}, options: head12_options, meta: {} };
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
						switch (pathname.slice(1, i1 - 1)) {
							case "api": {
								const i2 = pathname.indexOf('/', 5) + 1;
								if (!i2 || i2 === len) {
									if (pathname.slice(5, i2 ? -1 : len) === "events") return { handler: post5, path: "/api/events", params: {}, options: post5_options, meta: {} };
								}
							} break;
							case "admin": {
								const i2 = pathname.indexOf('/', 7) + 1;
								if (!i2 || i2 === len) {
									if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: post12, path: "/admin/users", params: {}, options: post12_options, meta: {} };
								}
							} break;
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
						switch (pathname.slice(1, i1 - 1)) {
							case "api": {
								const i2 = pathname.indexOf('/', 5) + 1;
								if (!i2 || i2 === len) {
									if (pathname.slice(5, i2 ? -1 : len) === "items") return { handler: put6, path: "/api/items", params: {}, options: put6_options, meta: {} };
								}
							} break;
							case "admin": {
								const i2 = pathname.indexOf('/', 7) + 1;
								if (!i2 || i2 === len) {
									if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: put12, path: "/admin/users", params: {}, options: put12_options, meta: {} };
								}
							} break;
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
						switch (pathname.slice(1, i1 - 1)) {
							case "api": {
								const i2 = pathname.indexOf('/', 5) + 1;
								if (!i2 || i2 === len) {
									if (pathname.slice(5, i2 ? -1 : len) === "items") return { handler: delete6, path: "/api/items", params: {}, options: delete6_options, meta: {} };
								}
							} break;
							case "admin": {
								const i2 = pathname.indexOf('/', 7) + 1;
								if (!i2 || i2 === len) {
									if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: delete12, path: "/admin/users", params: {}, options: delete12_options, meta: {} };
								}
							} break;
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
						switch (pathname.slice(1, i1 - 1)) {
							case "api": {
								const i2 = pathname.indexOf('/', 5) + 1;
								if (i2 && i2 !== len) {
									if (pathname.slice(5, i2 - 1) === "items") {
										const i3 = pathname.indexOf('/', 11) + 1;
										if (!i3 || i3 === len) {
											const s3 = decodeURIComponent(pathname.slice(11, i3 ? -1 : len));
											if (s3) return { handler: patch7, path: "/api/items/$id", params: { id: s3 }, options: patch7_options, meta: {} };
										}
									}
								}
							} break;
							case "admin": {
								const i2 = pathname.indexOf('/', 7) + 1;
								if (!i2 || i2 === len) {
									if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: patch12, path: "/admin/users", params: {}, options: patch12_options, meta: {} };
								}
							} break;
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
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: options12, path: "/admin/users", params: {}, options: options12_options, meta: {} };
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
								if (pathname.slice(7, i2 ? -1 : len) === "users") return { handler: query12, path: "/admin/users", params: {}, options: query12_options, meta: {} };
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
	url ??= new URL(request.url);
	const { search } = url;
	// Marko strips the request's URL marker, so no handler sees it.
	const kind = patchRequest(request.headers, url);
	if (kind === "stale") return new Response(null, { status: 412, headers: patchResponseHeaders(kind) });
	if (url.search !== search) request = unmarkedRequest(request, url.search);
	const response = await invoke_internal(route, request, platform, url, kind);
	return kind ? patchResponse(response, request) : response;
}

async function invoke_internal(route, request, platform, url, kind) {
	const context = createContext(route, request, platform, url, { kind, app: patchApp, headers: patchResponseHeaders });
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

    if (context.request.headers.get('Accept')?.includes('text/html') || kind) {
      return context.render(page404, { page: 2 }, { status: 404 });
    }	
    return new Response(null, {
      status: 404,
    });
	} catch (error) {
		if (context.request.headers.get('Accept')?.includes('text/html') || kind) {
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
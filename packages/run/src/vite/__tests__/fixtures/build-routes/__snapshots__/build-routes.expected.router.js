import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get3, get3_options, head3, head3_options } from "virtual:marko-run/__marko-run__index.js";
import { get4, get4_options, get4_meta, head4, head4_options, head4_meta, post4, post4_options, post4_meta } from "virtual:marko-run/__marko-run__new.js";
import { get5, get5_options, head5, head5_options, post5, post5_options, put5, put5_options, delete5, delete5_options } from "virtual:marko-run/__marko-run__notes.$.js";
import { post6, post6_options, post6_meta, put6, put6_options, put6_meta, delete6, delete6_options, delete6_meta } from "virtual:marko-run/__marko-run__notes.$.comments.js";
import { get7, get7_options, head7, head7_options } from "virtual:marko-run/__marko-run__callback.oauth2.js";
import { get8, get8_options, head8, head8_options } from "virtual:marko-run/__marko-run__my.js";
import { get9, get9_options, head9, head9_options } from "virtual:marko-run/__marko-run__$$.js";
import page404 from "./dist/.marko-run/404.marko";
import page500 from "./dist/.marko-run/500.marko";

const page404ResponseInit = {
  status: 404,
  headers: { "content-type": "text/html;charset=UTF-8" },
};

const page500ResponseInit = {
  status: 500,
  headers: { "content-type": "text/html;charset=UTF-8" },
};

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
			if (len === 1) return { handler: get3, path: '/', params: {}, options: get3_options, meta: {} };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'new': return { handler: get4, path: '/new', params: {}, options: get4_options, meta: get4_meta };
					case 'my': return { handler: get8, path: '/my', params: {}, options: get8_options, meta: {} };
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'notes': {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: get5, path: '/notes/$id', params: { id: s2 }, options: get5_options, meta: {} };
						}
					} break;
					case 'callback': {
						const i2 = pathname.indexOf('/', 10) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(10, i2 ? -1 : len) === 'oauth2') return { handler: get7, path: '/callback/oauth2', params: {}, options: get7_options, meta: {} };
						}
					} break;
				}
			}
			return { handler: get9, path: '/$$match', params: { match: pathname.slice(1) }, options: get9_options, meta: {} };
		}
		case 'HEAD':
		case 'head': {
			if (len === 1) return { handler: head3, path: '/', params: {}, options: head3_options, meta: {} };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'new': return { handler: head4, path: '/new', params: {}, options: head4_options, meta: head4_meta };
					case 'my': return { handler: head8, path: '/my', params: {}, options: head8_options, meta: {} };
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'notes': {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: head5, path: '/notes/$id', params: { id: s2 }, options: head5_options, meta: {} };
						}
					} break;
					case 'callback': {
						const i2 = pathname.indexOf('/', 10) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(10, i2 ? -1 : len) === 'oauth2') return { handler: head7, path: '/callback/oauth2', params: {}, options: head7_options, meta: {} };
						}
					} break;
				}
			}
			return { handler: head9, path: '/$$match', params: { match: pathname.slice(1) }, options: head9_options, meta: {} };
		}
		case 'POST':
		case 'post': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					if (pathname.slice(1, i1 ? -1 : len) === 'new') return { handler: post4, path: '/new', params: {}, options: post4_options, meta: post4_meta };
				} else {
					if (pathname.slice(1, i1 - 1) === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: post5, path: '/notes/$id', params: { id: s2 }, options: post5_options, meta: {} };
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len) === 'comments') return { handler: post6, path: '/notes/$id/comments', params: { id: s2 }, options: post6_options, meta: post6_meta };
								}
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
					if (pathname.slice(1, i1 - 1) === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: put5, path: '/notes/$id', params: { id: s2 }, options: put5_options, meta: {} };
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len) === 'comments') return { handler: put6, path: '/notes/$id/comments', params: { id: s2 }, options: put6_options, meta: put6_meta };
								}
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
					if (pathname.slice(1, i1 - 1) === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: delete5, path: '/notes/$id', params: { id: s2 }, options: delete5_options, meta: {} };
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len) === 'comments') return { handler: delete6, path: '/notes/$id/comments', params: { id: s2 }, options: delete6_options, meta: delete6_meta };
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
      return context.render(page404, {}, page404ResponseInit);
    }	
    return new Response(null, {
      status: 404,
    });
	} catch (error) {
		if (context.request.headers.get('Accept')?.includes('text/html')) {
			return context.render(page500, { error }, page500ResponseInit);
		}
		throw error;
	}
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
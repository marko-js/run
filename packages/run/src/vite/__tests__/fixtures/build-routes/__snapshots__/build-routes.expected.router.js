// @marko/run/router
import { NotHandled, NotMatched, createContext, pageResponse } from "virtual:marko-run/runtime/internal";
import { get3, head3 } from "virtual:marko-run/__marko-run__route.js";
import { get4, head4, post4, meta4 } from "virtual:marko-run/__marko-run__new.route.js";
import { get5, head5, post5, put5, delete5 } from "virtual:marko-run/__marko-run__notes.$.route.js";
import { post6, put6, delete6, meta6 } from "virtual:marko-run/__marko-run__notes.$.comments.route.js";
import { get7, head7 } from "virtual:marko-run/__marko-run__callback.oauth2.route.js";
import { get8, head8 } from "virtual:marko-run/__marko-run__my.route.js";
import { get9, head9 } from "virtual:marko-run/__marko-run__$$.route.js";
import page404 from "./dist/.marko-run/404.marko?marko-server-entry";
import page500 from "./dist/.marko-run/500.marko?marko-server-entry";

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
	if (!pathname) {
    pathname = '/';
  } else if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname;
  }
	switch (method) {
		case 'GET':
		case 'get': {
			const len = pathname.length;
			if (len === 1) return { handler: get3, params: {}, meta: {}, path: '/' };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'new': return { handler: get4, params: {}, meta: meta4, path: '/new' };
					case 'my': return { handler: get8, params: {}, meta: {}, path: '/my' };
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'notes': {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: get5, params: { id: s2 }, meta: {}, path: '/notes/$id' };
						}
					} break;
					case 'callback': {
						const i2 = pathname.indexOf('/', 10) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(10, i2 ? -1 : len) === 'oauth2') return { handler: get7, params: {}, meta: {}, path: '/callback/oauth2' };
						}
					} break;
				}
			}
			return { handler: get9, params: { match: pathname.slice(1) }, meta: {}, path: '/$$match' };
		}
		case 'HEAD':
		case 'head': {
			const len = pathname.length;
			if (len === 1) return { handler: head3, params: {}, meta: {}, path: '/' };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'new': return { handler: head4, params: {}, meta: meta4, path: '/new' };
					case 'my': return { handler: head8, params: {}, meta: {}, path: '/my' };
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'notes': {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: head5, params: { id: s2 }, meta: {}, path: '/notes/$id' };
						}
					} break;
					case 'callback': {
						const i2 = pathname.indexOf('/', 10) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(10, i2 ? -1 : len) === 'oauth2') return { handler: head7, params: {}, meta: {}, path: '/callback/oauth2' };
						}
					} break;
				}
			}
			return { handler: head9, params: { match: pathname.slice(1) }, meta: {}, path: '/$$match' };
		}
		case 'POST':
		case 'post': {
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					if (pathname.slice(1, i1 ? -1 : len) === 'new') return { handler: post4, params: {}, meta: meta4, path: '/new' };
				} else {
					if (pathname.slice(1, i1 - 1) === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: post5, params: { id: s2 }, meta: {}, path: '/notes/$id' };
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len) === 'comments') return { handler: post6, params: { id: s2 }, meta: meta6, path: '/notes/$id/comments' };
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
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: put5, params: { id: s2 }, meta: {}, path: '/notes/$id' };
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len) === 'comments') return { handler: put6, params: { id: s2 }, meta: meta6, path: '/notes/$id/comments' };
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
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: delete5, params: { id: s2 }, meta: {}, path: '/notes/$id' };
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len) === 'comments') return { handler: delete6, params: { id: s2 }, meta: meta6, path: '/notes/$id/comments' };
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
	const [context, buildInput] = createContext(route, request, platform, url);
	try {
		if (route) {
			try {
				const response = await route.handler(context, buildInput);
				if (response) return response;
			} catch (error) {
				if (error === NotHandled) return;
				if (error !== NotMatched) throw error;
			}
		}
    
    if (context.request.headers.get('Accept')?.includes('text/html')) {
      return pageResponse(page404, buildInput(), page404ResponseInit);
    }	
    return new Response(null, {
      status: 404,
    });
	} catch (error) {
		if (context.request.headers.get('Accept')?.includes('text/html')) {
			return pageResponse(page500, buildInput({ error }), page500ResponseInit);
		}
		throw error;
	}
}

export async function fetch(request, platform) {
  try {
    const url = new URL(request.url);
    let { pathname } = url;
    if (pathname !== '/' && pathname.endsWith('/')) {
      url.pathname = pathname.slice(0, -1);
      return Response.redirect(url);
    }   

    const route = match(request.method, pathname);
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
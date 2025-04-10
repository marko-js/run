// @marko/run/router
import { NotHandled, NotMatched, createContext, pageResponse } from 'virtual:marko-run/runtime/internal';
import { get1, head1 } from 'virtual:marko-run/__marko-run__route._protected._home.js';
import { get2, head2, post2, meta2 } from 'virtual:marko-run/__marko-run__route._protected._home.new.js';
import { get3, head3, post3, put3, delete3 } from 'virtual:marko-run/__marko-run__route._protected._home.notes.$id.js';
import { post4, put4, delete4, meta4 } from 'virtual:marko-run/__marko-run__route._protected._home.notes.$id.comments.js';
import { get5, head5 } from 'virtual:marko-run/__marko-run__route.callback.oauth2.js';
import { get6, head6 } from 'virtual:marko-run/__marko-run__route.my.js';
import { get7, head7 } from 'virtual:marko-run/__marko-run__route.$$match.js';
import page404 from './.marko/route.404.marko?marko-server-entry';
import page500 from './.marko/route.500.marko?marko-server-entry';

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
			if (len === 1) return { handler: get1, params: {}, meta: {}, path: '/' }; // /
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'new': return { handler: get2, params: {}, meta: meta2, path: '/new' }; // /new
					case 'my': return { handler: get6, params: {}, meta: {}, path: '/my' }; // /my
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'notes': {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: get3, params: { id: s2 }, meta: {}, path: '/notes/:id' }; // /notes/$id
						}
					} break;
					case 'callback': {
						const i2 = pathname.indexOf('/', 10) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(10, i2 ? -1 : len) === 'oauth2') return { handler: get5, params: {}, meta: {}, path: '/callback/oauth2' }; // /callback/oauth2
						}
					} break;
				}
			}
			return { handler: get7, params: { match: pathname.slice(1) }, meta: {}, path: '/:match*' }; // /$$match
		}
		case 'HEAD':
		case 'head': {
			const len = pathname.length;
			if (len === 1) return { handler: head1, params: {}, meta: {}, path: '/' }; // /
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len)) {
					case 'new': return { handler: head2, params: {}, meta: meta2, path: '/new' }; // /new
					case 'my': return { handler: head6, params: {}, meta: {}, path: '/my' }; // /my
				}
			} else {
				switch (pathname.slice(1, i1 - 1)) {
					case 'notes': {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: head3, params: { id: s2 }, meta: {}, path: '/notes/:id' }; // /notes/$id
						}
					} break;
					case 'callback': {
						const i2 = pathname.indexOf('/', 10) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(10, i2 ? -1 : len) === 'oauth2') return { handler: head5, params: {}, meta: {}, path: '/callback/oauth2' }; // /callback/oauth2
						}
					} break;
				}
			}
			return { handler: head7, params: { match: pathname.slice(1) }, meta: {}, path: '/:match*' }; // /$$match
		}
		case 'POST':
		case 'post': {
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					if (pathname.slice(1, i1 ? -1 : len) === 'new') return { handler: post2, params: {}, meta: meta2, path: '/new' }; // /new
				} else {
					if (pathname.slice(1, i1 - 1) === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(7, i2 ? -1 : len));
							if (s2) return { handler: post3, params: { id: s2 }, meta: {}, path: '/notes/:id' }; // /notes/$id
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len) === 'comments') return { handler: post4, params: { id: s2 }, meta: meta4, path: '/notes/:id/comments' }; // /notes/$id/comments
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
							if (s2) return { handler: put3, params: { id: s2 }, meta: {}, path: '/notes/:id' }; // /notes/$id
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len) === 'comments') return { handler: put4, params: { id: s2 }, meta: meta4, path: '/notes/:id/comments' }; // /notes/$id/comments
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
							if (s2) return { handler: delete3, params: { id: s2 }, meta: {}, path: '/notes/:id' }; // /notes/$id
						} else {
							const s2 = decodeURIComponent(pathname.slice(7, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len) === 'comments') return { handler: delete4, params: { id: s2 }, meta: meta4, path: '/notes/:id/comments' }; // /notes/$id/comments
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
// @marko/run/router
import { NotHandled, NotMatched, createInput } from 'virtual:marko-run/internal';
import { get1 } from 'virtual:marko-run/__marko-run__route__index.js';
import { get2, post2, meta2 } from 'virtual:marko-run/__marko-run__route__new.js';
import { get3, put3, post3, delete3 } from 'virtual:marko-run/__marko-run__route__notes__$.js';
import { put4, post4, delete4, meta4 } from 'virtual:marko-run/__marko-run__route__notes__$__comments.js';
import { get5 } from 'virtual:marko-run/__marko-run__route__callback__oauth2.js';
import { get6 } from 'virtual:marko-run/__marko-run__route__my.js';
import { get7 } from 'virtual:marko-run/__marko-run__route__$$.js';
import page404 from 'virtual:marko-run/__marko-run__special__404.marko?marko-server-entry';
import page500 from 'virtual:marko-run/__marko-run__special__500.marko?marko-server-entry';

export function match(method, pathname) {
	if (!pathname) {
    pathname = '/';
  } else if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname;
  }
	switch (method.toLowerCase()) {
		case 'get': {
			const len = pathname.length;
			if (len === 1) return { handler: get1, params: {}, meta: {} }; // /
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len).toLowerCase()) {
					case 'new': return { handler: get2, params: {}, meta: meta2 }; // /new
					case 'my': return { handler: get6, params: {}, meta: {} }; // /my
				}
			} else {
				switch (pathname.slice(1, i1 - 1).toLowerCase()) {
					case 'notes': {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = pathname.slice(7, i2 ? -1 : len);
							if (s2) return { handler: get3, params: { id: s2 }, meta: {} }; // /notes/$id
						}
					}
					case 'callback': {
						const i2 = pathname.indexOf('/', 10) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(10, i2 ? -1 : len).toLowerCase() === 'oauth2') return { handler: get5, params: {}, meta: {} }; // /callback/oauth2
						}
					}
				}
			}
			return { handler: get7, params: { match: pathname.slice(1) }, meta: {} }; // /$$match
		}
		case 'post': {
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					if (pathname.slice(1, i1 ? -1 : len).toLowerCase() === 'new') return { handler: post2, params: {}, meta: meta2 }; // /new
				} else {
					if (pathname.slice(1, i1 - 1).toLowerCase() === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = pathname.slice(7, i2 ? -1 : len);
							if (s2) return { handler: post3, params: { id: s2 }, meta: {} }; // /notes/$id
						} else {
							const s2 = pathname.slice(7, i2 - 1);
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len).toLowerCase() === 'comments') return { handler: post4, params: { id: s2 }, meta: meta4 }; // /notes/$id/comments
								}
							}
						}
					}
				}
			}
			return null;
		}
		case 'put': {
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1).toLowerCase() === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = pathname.slice(7, i2 ? -1 : len);
							if (s2) return { handler: put3, params: { id: s2 }, meta: {} }; // /notes/$id
						} else {
							const s2 = pathname.slice(7, i2 - 1);
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len).toLowerCase() === 'comments') return { handler: put4, params: { id: s2 }, meta: meta4 }; // /notes/$id/comments
								}
							}
						}
					}
				}
			}
			return null;
		}
		case 'delete': {
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1).toLowerCase() === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = pathname.slice(7, i2 ? -1 : len);
							if (s2) return { handler: delete3, params: { id: s2 }, meta: {} }; // /notes/$id
						} else {
							const s2 = pathname.slice(7, i2 - 1);
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len).toLowerCase() === 'comments') return { handler: delete4, params: { id: s2 }, meta: meta4 }; // /notes/$id/comments
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

export async function invoke(route, request, platform, url = new URL(request.url)) {
  const context = {
    url,
    request,
    platform,
		serializedGlobals: { params: true }
  };
  const buildInput = createInput(context);
	try {
		if (route) {
			context.params = route.params;
			context.meta = route.meta;
      try {
				const response = await route.handler(context, buildInput);
				if (response) return response;
			} catch (error) {
				if (error === NotHandled) {
					return;
				} else if (error !== NotMatched) {
					throw error;
				}
			}
    } else {
      context.params = {};
      context.meta = {};
    }
    if (context.request.headers.get('Accept')?.includes('text/html')) {
      return new Response(page404.stream(buildInput()), {
        status: 404,
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }
	} catch (error) {
		if (context.request.headers.get('Accept')?.includes('text/html')) {
			return new Response(page500.stream(buildInput({ error })), {
				status: 500,
				headers: { "content-type": "text/html;charset=UTF-8" },
			});
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
    const body = import.meta.env.DEV
      ? error.stack || error.message || "Internal Server Error"
      : null;
    return new Response(body, {
      status: 500
    });
  }
}
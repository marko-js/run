// @marko/run/router
import { RequestNotHandled, RequestNotMatched, createInput } from 'virtual:marko-run/internal';
import { get$1 } from 'virtual:marko-run/__marko-run__route__index.js';
import { get$2, post$2, meta$2 } from 'virtual:marko-run/__marko-run__route__new.js';
import { get$3, post$3 } from 'virtual:marko-run/__marko-run__route__notes__$.js';
import { post$4, meta$4 } from 'virtual:marko-run/__marko-run__route__notes__$__comments.js';
import { get$5 } from 'virtual:marko-run/__marko-run__route__callback__oauth2.js';
import { get$6 } from 'virtual:marko-run/__marko-run__route__my.js';
import { get$7 } from 'virtual:marko-run/__marko-run__route__$$.js';
import page$404 from 'virtual:marko-run/__marko-run__special__404.marko?marko-server-entry';
import page$500 from 'virtual:marko-run/__marko-run__special__500.marko?marko-server-entry';

function findRoute(method, pathname) {
	switch (method.toLowerCase()) {
		case 'get': {
			const len = pathname.length;
			if (len === 1) return { handler: get$1, params: {}, meta: {} }; // /
			const i1 = pathname.indexOf('/', 1) + 1;
			if (!i1 || i1 === len) {
				switch (pathname.slice(1, i1 ? -1 : len).toLowerCase()) {
					case 'new': return { handler: get$2, params: {}, meta: meta$2 }; // /new
					case 'my': return { handler: get$6, params: {}, meta: {} }; // /my
				}
			} else {
				switch (pathname.slice(1, i1 - 1).toLowerCase()) {
					case 'notes': {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = pathname.slice(7, i2 ? -1 : len);
							if (s2) return { handler: get$3, params: { id: s2 }, meta: {} }; // /notes/$id
						}
					}
					case 'callback': {
						const i2 = pathname.indexOf('/', 10) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(10, i2 ? -1 : len).toLowerCase() === 'oauth2') return { handler: get$5, params: {}, meta: {} }; // /callback/oauth2
						}
					}
				}
			}
			return { handler: get$7, params: { match: pathname.slice(1) }, meta: {} }; // /$$match
		}
		case 'post': {
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					if (pathname.slice(1, i1 ? -1 : len).toLowerCase() === 'new') return { handler: post$2, params: {}, meta: meta$2 }; // /new
				} else {
					if (pathname.slice(1, i1 - 1).toLowerCase() === 'notes') {
						const i2 = pathname.indexOf('/', 7) + 1;
						if (!i2 || i2 === len) {
							const s2 = pathname.slice(7, i2 ? -1 : len);
							if (s2) return { handler: post$3, params: { id: s2 }, meta: {} }; // /notes/$id
						} else {
							const s2 = pathname.slice(7, i2 - 1);
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (pathname.slice(i2, i3 ? -1 : len).toLowerCase() === 'comments') return { handler: post$4, params: { id: s2 }, meta: meta$4 }; // /notes/$id/comments
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

export function matchRoute(method, pathname) {
  if (!pathname) {
    pathname = '/';
  } else if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname;
  }
  return findRoute(method, pathname);
}

export async function invokeRoute(route, context) {
	try {
    const buildInput = createInput(context);
		if (route) {
			context.params = route.params;
			context.meta = route.meta;
      try {
				const response = await route.handler(context, buildInput);
				if (response) return response;
			} catch (error) {
				if (error === RequestNotHandled) {
					return;
				} else if (error !== RequestNotMatched) {
					throw error;
				}
			}
    } else {
      context.params = {};
      context.meta = {};
    }
    if (context.request.headers.get('Accept')?.includes('text/html')) {
      return new Response(page$404.stream(buildInput()), {
        status: 404,
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }
	} catch (error) {
		if (context.request.headers.get('Accept')?.includes('text/html')) {
			return new Response(page$500.stream(buildInput({ error })), {
				status: 500,
				headers: { "content-type": "text/html;charset=UTF-8" },
			});
		}
		throw error;
	}
}

export async function router(context) {
  try {
    const { url, method } = context;
    let { pathname } = url;
    if (pathname !== '/' && pathname.endsWith('/')) {
      url.pathname = pathname.slice(0, -1);
      return Response.redirect(url);
    }   

    const route = matchRoute(method, pathname);
    return await invokeRoute(route, context);
  } catch (error) {
    const message = import.meta.env.DEV
      ? `Internal Server Error (${error.message})`
      : "Internal Server Error";

    return new Response(
      JSON.stringify({
        error: {
          message,
          stack: import.meta.env.DEV
            ? `This will only be seen in development mode\n\n${error.stack}`
            : ""
        }
      }),
      {
        statusText: message,
        status: 500,
      }
    );
  }
}
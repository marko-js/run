// @marko/run/router
import { once } from "events";
import { Readable } from "stream";
import { get$1, put$1, post$1, delete$1, meta$1 } from 'virtual:marko-serve/__marko-serve__route__index.js';
import { get$2, post$2, delete$2, meta$2 } from 'virtual:marko-serve/__marko-serve__route__sales__about.js';
import { get$3 } from 'virtual:marko-serve/__marko-serve__route__$$.js';
import { get$4 } from 'virtual:marko-serve/__marko-serve__route__sales.js';
import { get$5 } from 'virtual:marko-serve/__marko-serve__route__sales__invoicing.js';
import { get$6 } from 'virtual:marko-serve/__marko-serve__route__sales__invoicing__$$.js';
import { get$7 } from 'virtual:marko-serve/__marko-serve__route__sales__invoicing__$.js';
import { get$8 } from 'virtual:marko-serve/__marko-serve__route__sales__invoicing__foo.js';
import { get$9 } from 'virtual:marko-serve/__marko-serve__route__sales__summary.js';
import page$404 from 'virtual:marko-serve/__marko-serve__special__404.marko?marko-server-entry';
import page$500 from 'virtual:marko-serve/__marko-serve__special__500.marko?marko-server-entry';

function matchRoute(method, pathname) {
	switch (method.toLowerCase()) {
		case 'get': {
			if (pathname === '/') return [get$1, , meta$1]; // /
			const segments = pathname.split('/');
			const len = segments.length;
			if (segments[1]?.toLowerCase() === 'sales') {
				if (len === 2) return [get$4]; // /sales
				switch(segments[2]?.toLowerCase()) {
					case 'about':
						if (len === 3) return [get$2, , meta$2]; // /sales/about
						break;
					case 'invoicing':
						if (len === 3) return [get$5]; // /sales/invoicing
						if (segments[3]?.toLowerCase() === 'foo') {
							if (len === 4) return [get$8]; // /sales/invoicing/foo
						}
						if (segments[3]) {
							if (len === 4) return [get$7, { 'id': segments[3] }]; // /sales/invoicing/$id
						}
						return [get$6, { 'rest': pathname.slice(14) }]; // /sales/invoicing/$$rest
					case 'summary':
						if (len === 3) return [get$9]; // /sales/summary
						break;
				}
			}
			return [get$3, {}]; // /$$
		}
		case 'post': {
			if (pathname === '/') return [post$1, , meta$1]; // /
			const segments = pathname.split('/');
			const len = segments.length;
			if (segments[1]?.toLowerCase() === 'sales') {
				if (segments[2]?.toLowerCase() === 'about') {
					if (len === 3) return [post$2, , meta$2]; // /sales/about
				}
			}
			return;
		}
		case 'put': {
			if (pathname === '/') return [put$1, , meta$1]; // /
			return;
		}
		case 'delete': {
			if (pathname === '/') return [delete$1, , meta$1]; // /
			const segments = pathname.split('/');
			const len = segments.length;
			if (segments[1]?.toLowerCase() === 'sales') {
				if (segments[2]?.toLowerCase() === 'about') {
					if (len === 3) return [delete$2, , meta$2]; // /sales/about
				}
			}
			return;
		}
	}
}

async function invokeRoute(route, url, request) {
	try {
		if (route) {
			const [handler, params = {}, meta] = route;
			const response = await handler({ request, url, params, meta });
			if (response) return response;
		}
		if (request.headers.get('Accept')?.includes('text/html')) {
			return new Response(page$404.stream({ request, url, params: {} }), {
				status: 404,
				headers: { "content-type": "text/html;charset=UTF-8" },
			});
		}
		return null;
	} catch (err) {
		if (request.headers.get('Accept')?.includes('text/html')) {
			return new Response(page$500.stream({ request, url, params: {}, error: err }), {
				status: 500,
				headers: { "content-type": "text/html;charset=UTF-8" },
			});
		}
		throw err;
	}
}

export function getMatchedRoute(method, url) {
  const route = matchRoute(method, url.pathname);
  if (route) {
    const [handler, params = {}, meta] = route;
    return {
      handler,
      params,
      meta,
      async invoke(request) {
        return await invokeRoute(route, url, request);
      }
    }
  }
  return null;
}

export async function handler(context) {
	const response = await router(context.request);
	if (response.body) {
		//context.waitUntil?.(once(Readable.from(response.body), "end"));
	}
	return response;
}

export async function router(request) {
  try {
    const url = new URL(request.url);
    let { pathname } = url;

    if (pathname !== '/') {
      if (pathname.endsWith('/')) {
        pathname = pathname.replace(/\/+$/, '');

        url.pathname = pathname;
        return Response.redirect(url.href);

      }
    }
    const route = matchRoute(request.method, pathname);
    return await invokeRoute(route, url, request) || new Response(null, {
      statusText: `Not Found (No route matched ${pathname})`,
      status: 404
    });
  } catch (err) {
    const message = import.meta.env.DEV
      ? `Internal Server Error (${err.message})`
      : "Internal Server Error";

    return new Response(
      JSON.stringify({
        error: {
          message,
          stack: import.meta.env.DEV
            ? `This will only be seen in development mode\n\n${err.stack}`
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
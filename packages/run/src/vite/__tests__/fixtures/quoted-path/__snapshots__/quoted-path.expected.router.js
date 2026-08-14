import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, get1_options, head1, head1_options } from "virtual:marko-run/__marko-run__faq.it's-here.js";
import { get2, get2_options, head2, head2_options } from "virtual:marko-run/__marko-run__faq.it's-here.deeper's.js";
import { get3, get3_options, head3, head3_options } from "virtual:marko-run/__marko-run__faq.$.js";

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
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === "faq") {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(5, i2 ? -1 : len));
							if (s2 === "it's-here") return { handler: get1, path: "/faq/it's-here", params: {}, options: get1_options, meta: {} };
							if (s2) return { handler: get3, path: "/faq/$it's", params: { "it's": s2 }, options: get3_options, meta: {} };
						} else {
							if (decodeURIComponent(pathname.slice(5, i2 - 1)) === "it's-here") {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (decodeURIComponent(pathname.slice(i2, i3 ? -1 : len)) === "deeper's") return { handler: get2, path: "/faq/it's-here/deeper's", params: {}, options: get2_options, meta: {} };
								}
							}
						}
					}
				}
			}
			return null;
		}
		case 'HEAD':
		case 'head': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === "faq") {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(5, i2 ? -1 : len));
							if (s2 === "it's-here") return { handler: head1, path: "/faq/it's-here", params: {}, options: head1_options, meta: {} };
							if (s2) return { handler: head3, path: "/faq/$it's", params: { "it's": s2 }, options: head3_options, meta: {} };
						} else {
							if (decodeURIComponent(pathname.slice(5, i2 - 1)) === "it's-here") {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (!i3 || i3 === len) {
									if (decodeURIComponent(pathname.slice(i2, i3 ? -1 : len)) === "deeper's") return { handler: head2, path: "/faq/it's-here/deeper's", params: {}, options: head2_options, meta: {} };
								}
							}
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
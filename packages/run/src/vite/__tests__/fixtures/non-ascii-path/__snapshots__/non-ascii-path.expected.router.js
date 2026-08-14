import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, get1_options, head1, head1_options } from "virtual:marko-run/__marko-run__café.js";
import { get2, get2_options, head2, head2_options } from "virtual:marko-run/__marko-run__café.sub.js";
import { get3, get3_options, head3, head3_options } from "virtual:marko-run/__marko-run__menu.js";

globalThis.__marko_run__ = { match, fetch, invoke };
    
export function match(method, pathname) {
	return match_internal(method, pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname)
};
  
function match_internal(method, pathname) {
  const len = pathname.length;
	switch (method) {
		case 'GET':
		case 'get': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					switch (decodeURIComponent(pathname.slice(1, i1 ? -1 : len))) {
						case "café": return { handler: get1, path: "/café", params: {}, options: get1_options, meta: {} };
						case "menu": return { handler: get3, path: "/menu", params: {}, options: get3_options, meta: {} };
					}
				} else {
					if (decodeURIComponent(pathname.slice(1, i1 - 1)) === "café") {
						const i2 = pathname.indexOf('/', i1) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(i1, i2 ? -1 : len) === "sub") return { handler: get2, path: "/café/sub", params: {}, options: get2_options, meta: {} };
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
				if (!i1 || i1 === len) {
					switch (decodeURIComponent(pathname.slice(1, i1 ? -1 : len))) {
						case "café": return { handler: head1, path: "/café", params: {}, options: head1_options, meta: {} };
						case "menu": return { handler: head3, path: "/menu", params: {}, options: head3_options, meta: {} };
					}
				} else {
					if (decodeURIComponent(pathname.slice(1, i1 - 1)) === "café") {
						const i2 = pathname.indexOf('/', i1) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(i1, i2 ? -1 : len) === "sub") return { handler: head2, path: "/café/sub", params: {}, options: head2_options, meta: {} };
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
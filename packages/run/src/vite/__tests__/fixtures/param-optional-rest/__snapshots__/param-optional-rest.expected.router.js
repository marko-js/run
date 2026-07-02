import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, get1_options, head1, head1_options } from "virtual:marko-run/__marko-run__$.js";
import { get2, get2_options, head2, head2_options } from "virtual:marko-run/__marko-run__$.$$.js";

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
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (!i1 || i1 === len) {
					const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
					if (s1) return { handler: get1, path: '/$campaignId', params: { campaignId: s1 }, options: get1_options, meta: {} };
				} else {
					const s1 = decodeURIComponent(pathname.slice(1, i1 - 1));
					if (s1) {
						return { handler: get2, path: '/$campaignId/$$rest', params: { campaignId: s1, rest: pathname.slice(i1) }, options: get2_options, meta: {} };
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
					const s1 = decodeURIComponent(pathname.slice(1, i1 ? -1 : len));
					if (s1) return { handler: head1, path: '/$campaignId', params: { campaignId: s1 }, options: head1_options, meta: {} };
				} else {
					const s1 = decodeURIComponent(pathname.slice(1, i1 - 1));
					if (s1) {
						return { handler: head2, path: '/$campaignId/$$rest', params: { campaignId: s1, rest: pathname.slice(i1) }, options: head2_options, meta: {} };
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
import { NotHandled, NotMatched, createContext, initializePersisted } from "virtual:marko-run/runtime/internal";
import { buildId } from "virtual:marko-vite/link-assets";
import { get2, get2_options, head2, head2_options, persisted2 } from "virtual:marko-run/__marko-run__index.js";
import { get3, get3_options, head3, head3_options, persisted3 } from "virtual:marko-run/__marko-run__item.new.js";
import { get4, get4_options, head4, head4_options, persisted4 } from "virtual:marko-run/__marko-run__item.$.js";
import { get5, get5_options, head5, head5_options, persisted5 } from "virtual:marko-run/__marko-run__docs.intro.js";
import { get6, get6_options, head6, head6_options, persisted6 } from "virtual:marko-run/__marko-run__docs.$$.js";
import page404 from "./dist/.marko-run/404.marko";

const page404ResponseInit = {
  status: 404,
  headers: { "content-type": "text/html;charset=UTF-8" },
};
const persisted = [,,persisted2,persisted3,persisted4,persisted5,persisted6];

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
			if (len === 1) return { handler: get2, i: 2, path: '/', params: {}, options: get2_options, meta: {} };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (i1 && i1 !== len) {
				switch (pathname.slice(1, i1 - 1)) {
					case 'item': {
						const i2 = pathname.indexOf('/', 6) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
							if (s2 === 'new') return { handler: get3, i: 3, path: '/item/new', params: {}, options: get3_options, meta: {} };
							if (s2) return { handler: get4, i: 4, path: '/item/$id', params: { id: s2 }, options: get4_options, meta: {} };
						}
					} break;
					case 'docs': {
						const i2 = pathname.indexOf('/', 6) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(6, i2 ? -1 : len) === 'intro') return { handler: get5, i: 5, path: '/docs/intro', params: {}, options: get5_options, meta: {} };
						}
						return { handler: get6, i: 6, path: '/docs/$$rest', params: { rest: pathname.slice(6) }, options: get6_options, meta: {} };
					} break;
				}
			}
			return null;
		}
		case 'HEAD':
		case 'head': {
			if (len === 1) return { handler: head2, i: 2, path: '/', params: {}, options: head2_options, meta: {} };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (i1 && i1 !== len) {
				switch (pathname.slice(1, i1 - 1)) {
					case 'item': {
						const i2 = pathname.indexOf('/', 6) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
							if (s2 === 'new') return { handler: head3, i: 3, path: '/item/new', params: {}, options: head3_options, meta: {} };
							if (s2) return { handler: head4, i: 4, path: '/item/$id', params: { id: s2 }, options: head4_options, meta: {} };
						}
					} break;
					case 'docs': {
						const i2 = pathname.indexOf('/', 6) + 1;
						if (!i2 || i2 === len) {
							if (pathname.slice(6, i2 ? -1 : len) === 'intro') return { handler: head5, i: 5, path: '/docs/intro', params: {}, options: head5_options, meta: {} };
						}
						return { handler: head6, i: 6, path: '/docs/$$rest', params: { rest: pathname.slice(6) }, options: head6_options, meta: {} };
					} break;
				}
			}
			return null;
		}
	}
	return null;
}

export async function invoke(route, request, platform, url) {
	const context = createContext(route, request, platform, url);
	const persistedMismatch = initializePersisted(
    context,
    route?.i,
    buildId(),
    persisted,
  );
  if (persistedMismatch) return persistedMismatch;
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
import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { buildId } from "virtual:marko-vite/link-assets";

let resolvedBuildHash;
function getBuildHash() {
  return (resolvedBuildHash ??=
    buildId() || Math.random().toString(36).slice(2));
}
import { get2, get2_options, head2, head2_options } from "virtual:marko-run/__marko-run__index.js";
import { get3, get3_options, head3, head3_options } from "virtual:marko-run/__marko-run__item.$.js";
import { get4, get4_options, head4, head4_options } from "virtual:marko-run/__marko-run__docs.$$.js";
import page404 from "./dist/.marko-run/404.marko";

const page404ResponseInit = {
  status: 404,
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
			if (len === 1) return { handler: get2, path: '/', params: {}, options: get2_options, meta: {} };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (i1 && i1 !== len) {
				switch (pathname.slice(1, i1 - 1)) {
					case 'item': {
						const i2 = pathname.indexOf('/', 6) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
							if (s2) return { handler: get3, path: '/item/$id', params: { id: s2 }, options: get3_options, meta: {} };
						}
					} break;
					case 'docs': {
						return { handler: get4, path: '/docs/$$rest', params: { rest: pathname.slice(6) }, options: get4_options, meta: {} };
					} break;
				}
			}
			return null;
		}
		case 'HEAD':
		case 'head': {
			if (len === 1) return { handler: head2, path: '/', params: {}, options: head2_options, meta: {} };
			const i1 = pathname.indexOf('/', 1) + 1;
			if (i1 && i1 !== len) {
				switch (pathname.slice(1, i1 - 1)) {
					case 'item': {
						const i2 = pathname.indexOf('/', 6) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
							if (s2) return { handler: head3, path: '/item/$id', params: { id: s2 }, options: head3_options, meta: {} };
						}
					} break;
					case 'docs': {
						return { handler: head4, path: '/docs/$$rest', params: { rest: pathname.slice(6) }, options: head4_options, meta: {} };
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
	context.persisted = true;
  context.buildHash = getBuildHash();
  context.serializedGlobals.buildHash = true;
  if (
    route &&
    request.headers.get("accept")?.includes("text/marko-patch")
  ) {
    if (
      request.headers.get("x-marko-route") === route.path &&
      request.headers.get("x-marko-build") === context.buildHash
    ) {
      context.persisted = "update";
      // Cross-route navigations (the client's current route differs) swap
      // in a fresh subtree the client cannot compute state for -- seed-mode
      // payloads serialize state values too; the client seeds them only
      // into scopes created during the apply.
      context.persistedSeed =
        request.headers.get("x-marko-from") !== route.path;
    } else {
      return new Response(null, { status: 409, headers: { vary: "accept" } });
    }
  }
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
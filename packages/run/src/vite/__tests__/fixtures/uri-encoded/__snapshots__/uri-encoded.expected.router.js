// @marko/run/router
import { NotHandled, NotMatched, createContext } from 'virtual:marko-run/runtime/internal';
import { get1, head1 } from 'virtual:marko-run/__marko-run__route.a_b_c.$_id.js';

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
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (decodeURIComponent(pathname.slice(1, i1 - 1)) === 'a/b/c') {
						const i2 = pathname.indexOf('/', 11) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(11, i2 ? -1 : len));
							if (s2) return { handler: get1, params: { $id: s2 }, meta: {}, path: '/a%2Fb%2Fc/:$id' }; // /a%2Fb%2Fc/$%24id
						}
					}
				}
			}
			return null;
		}
		case 'HEAD':
		case 'head': {
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (decodeURIComponent(pathname.slice(1, i1 - 1)) === 'a/b/c') {
						const i2 = pathname.indexOf('/', 11) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(11, i2 ? -1 : len));
							if (s2) return { handler: head1, params: { $id: s2 }, meta: {}, path: '/a%2Fb%2Fc/:$id' }; // /a%2Fb%2Fc/$%24id
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
	if (route) {
		try {
			const response = await route.handler(context, buildInput);
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
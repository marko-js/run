import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, get1_options, head1, head1_options, post1, post1_options } from "virtual:marko-run/__marko-run__index.js";

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
			if (len === 1) return { handler: get1, path: "/", params: {}, options: get1_options, meta: {} };
			return null;
		}
		case 'HEAD':
		case 'head': {
			if (len === 1) return { handler: head1, path: "/", params: {}, options: head1_options, meta: {} };
			return null;
		}
		case 'POST':
		case 'post': {
			if (len === 1) return { handler: post1, path: "/", params: {}, options: post1_options, meta: {} };
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
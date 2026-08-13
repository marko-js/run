import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get2, get2_options, head2, head2_options } from "virtual:marko-run/__marko-run__index.js";
import page500 from "./dist/.marko-run/500.marko";

const page500ResponseInit = {
  status: 500,
  headers: { "content-type": "text/html;charset=UTF-8" },
};

globalThis.__marko_run__ = { match, fetch, invoke };
    
export function match(method, pathname) {
	return match_internal(method, pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname)
};
  
function match_internal(method, pathname) {
  const len = pathname.length;
	switch (method) {
		case 'GET':
		case 'get': {
			if (len === 1) return { handler: get2, path: '/', params: {}, options: get2_options, meta: {} };
			return null;
		}
		case 'HEAD':
		case 'head': {
			if (len === 1) return { handler: head2, path: '/', params: {}, options: head2_options, meta: {} };
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
	try {
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
	} catch (error) {
		if (context.request.headers.get('Accept')?.includes('text/html')) {
			return context.render(page500, { error }, page500ResponseInit);
		}
		throw error;
	}
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
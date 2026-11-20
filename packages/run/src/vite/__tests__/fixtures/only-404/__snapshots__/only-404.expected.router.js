import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import page404 from "./dist/.marko-run/404.marko";

globalThis.__marko_run__ = { match, fetch, invoke };
    
export function match(method, pathname) {
	return match_internal(method, pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname)
};

function match_internal(method, pathname) {
  const len = pathname.length;
	try {
		switch (method) {
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

    if (context.request.headers.get('Accept')?.includes('text/html')) {
      return context.render(page404, {}, { status: 404, headers: { vary: 'accept' } });
    }
    return new Response(null, {
      status: 404,
      headers: { vary: 'accept' },
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
// @marko/run/router
import { NotHandled, NotMatched, createContext } from 'virtual:marko-run/internal';
import { get1 } from 'virtual:marko-run/__marko-run__route.aaa.$aId.js';
import { get2 } from 'virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.js';
import { get3 } from 'virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.ccc.$cId.js';
import { get4 } from 'virtual:marko-run/__marko-run__route.aaa.$aId.ccc.$cId.js';

globalThis.__marko_run__ = { match, fetch, invoke };
    
export function match(method, pathname) {
	if (!pathname) {
    pathname = '/';
  } else if (pathname.charAt(0) !== '/') {
    pathname = '/' + pathname;
  }
	switch (method.toLowerCase()) {
		case 'get': {
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (decodeURIComponent(pathname.slice(1, i1 - 1)).toLowerCase() === 'aaa') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(5, i2 ? -1 : len));
							if (s2) return { handler: get1, params: { aId: s2 }, meta: {}, path: '/aaa/:aId' }; // /aaa/$aId
						} else {
							const s2 = decodeURIComponent(pathname.slice(5, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (i3 && i3 !== len) {
									switch (decodeURIComponent(pathname.slice(i2, i3 - 1)).toLowerCase()) {
										case 'bbb': {
											const i4 = pathname.indexOf('/', i3) + 1;
											if (!i4 || i4 === len) {
												const s4 = decodeURIComponent(pathname.slice(i3, i4 ? -1 : len));
												if (s4) return { handler: get2, params: { aId: s2, bId: s4 }, meta: {}, path: '/aaa/:aId/bbb/:bId' }; // /aaa/$aId/bbb/$bId
											} else {
												const s4 = decodeURIComponent(pathname.slice(i3, i4 - 1));
												if (s4) {
													const i5 = pathname.indexOf('/', i4) + 1;
													if (i5 && i5 !== len) {
														if (decodeURIComponent(pathname.slice(i4, i5 - 1)).toLowerCase() === 'ccc') {
															const i6 = pathname.indexOf('/', i5) + 1;
															if (!i6 || i6 === len) {
																const s6 = decodeURIComponent(pathname.slice(i5, i6 ? -1 : len));
																if (s6) return { handler: get3, params: { aId: s2, bId: s4, cId: s6 }, meta: {}, path: '/aaa/:aId/bbb/:bId/ccc/:cId' }; // /aaa/$aId/bbb/$bId/ccc/$cId
															}
														}
													}
												}
											}
										} break;
										case 'ccc': {
											const i4 = pathname.indexOf('/', i3) + 1;
											if (!i4 || i4 === len) {
												const s4 = decodeURIComponent(pathname.slice(i3, i4 ? -1 : len));
												if (s4) return { handler: get4, params: { aId: s2, cId: s4 }, meta: {}, path: '/aaa/:aId/ccc/:cId' }; // /aaa/$aId/ccc/$cId
											}
										} break;
									}
								}
							}
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
	try {
		if (route) {
      try {
				const response = await route.handler(context, buildInput);
				if (response) return response;
			} catch (error) {
				if (error === NotHandled) {
					return;
				} else if (error !== NotMatched) {
					throw error;
				}
			}
		}
	} catch (error) {
		throw error;
	}
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
    const body = import.meta.env.DEV
      ? error.stack || error.message || "Internal Server Error"
      : null;
    return new Response(body, {
      status: 500
    });
  }
}
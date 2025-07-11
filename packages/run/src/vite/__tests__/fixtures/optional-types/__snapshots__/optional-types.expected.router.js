// @marko/run/router
import { NotHandled, NotMatched, createContext } from "virtual:marko-run/runtime/internal";
import { get1, head1 } from "virtual:marko-run/__marko-run__aaa.$.route.js";
import { get2, head2 } from "virtual:marko-run/__marko-run__aaa.$.bbb.$.route.js";
import { get3, head3 } from "virtual:marko-run/__marko-run__aaa.$.bbb.$.ccc.$.route.js";
import { get4, head4 } from "virtual:marko-run/__marko-run__aaa.$.ccc.$.route.js";

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
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === 'aaa') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(5, i2 ? -1 : len));
							if (s2) return { handler: get1, params: { aId: s2 }, meta: {}, path: '/aaa/$aId' };
						} else {
							const s2 = decodeURIComponent(pathname.slice(5, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (i3 && i3 !== len) {
									switch (pathname.slice(i2, i3 - 1)) {
										case 'bbb': {
											const i4 = pathname.indexOf('/', i3) + 1;
											if (!i4 || i4 === len) {
												const s4 = decodeURIComponent(pathname.slice(i3, i4 ? -1 : len));
												if (s4) return { handler: get2, params: { aId: s2, bId: s4 }, meta: {}, path: '/aaa/$aId/bbb/$bId' };
											} else {
												const s4 = decodeURIComponent(pathname.slice(i3, i4 - 1));
												if (s4) {
													const i5 = pathname.indexOf('/', i4) + 1;
													if (i5 && i5 !== len) {
														if (pathname.slice(i4, i5 - 1) === 'ccc') {
															const i6 = pathname.indexOf('/', i5) + 1;
															if (!i6 || i6 === len) {
																const s6 = decodeURIComponent(pathname.slice(i5, i6 ? -1 : len));
																if (s6) return { handler: get3, params: { aId: s2, bId: s4, cId: s6 }, meta: {}, path: '/aaa/$aId/bbb/$bId/ccc/$cId' };
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
												if (s4) return { handler: get4, params: { aId: s2, cId: s4 }, meta: {}, path: '/aaa/$aId/ccc/$cId' };
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
		case 'HEAD':
		case 'head': {
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === 'aaa') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (!i2 || i2 === len) {
							const s2 = decodeURIComponent(pathname.slice(5, i2 ? -1 : len));
							if (s2) return { handler: head1, params: { aId: s2 }, meta: {}, path: '/aaa/$aId' };
						} else {
							const s2 = decodeURIComponent(pathname.slice(5, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (i3 && i3 !== len) {
									switch (pathname.slice(i2, i3 - 1)) {
										case 'bbb': {
											const i4 = pathname.indexOf('/', i3) + 1;
											if (!i4 || i4 === len) {
												const s4 = decodeURIComponent(pathname.slice(i3, i4 ? -1 : len));
												if (s4) return { handler: head2, params: { aId: s2, bId: s4 }, meta: {}, path: '/aaa/$aId/bbb/$bId' };
											} else {
												const s4 = decodeURIComponent(pathname.slice(i3, i4 - 1));
												if (s4) {
													const i5 = pathname.indexOf('/', i4) + 1;
													if (i5 && i5 !== len) {
														if (pathname.slice(i4, i5 - 1) === 'ccc') {
															const i6 = pathname.indexOf('/', i5) + 1;
															if (!i6 || i6 === len) {
																const s6 = decodeURIComponent(pathname.slice(i5, i6 ? -1 : len));
																if (s6) return { handler: head3, params: { aId: s2, bId: s4, cId: s6 }, meta: {}, path: '/aaa/$aId/bbb/$bId/ccc/$cId' };
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
												if (s4) return { handler: head4, params: { aId: s2, cId: s4 }, meta: {}, path: '/aaa/$aId/ccc/$cId' };
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
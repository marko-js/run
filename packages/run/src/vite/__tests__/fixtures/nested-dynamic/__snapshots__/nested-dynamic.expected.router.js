// @marko/run/router
import { NotHandled, NotMatched, createContext } from 'virtual:marko-run/runtime/internal';
import { get1, head1 } from 'virtual:marko-run/__marko-run__route.foo.$fooId.bar.$bar Id.baz.$1bazId.$qux-Id.js';

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
					if (pathname.slice(1, i1 - 1) === 'foo') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (i2 && i2 !== len) {
							const s2 = decodeURIComponent(pathname.slice(5, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (i3 && i3 !== len) {
									if (pathname.slice(i2, i3 - 1) === 'bar') {
										const i4 = pathname.indexOf('/', i3) + 1;
										if (i4 && i4 !== len) {
											const s4 = decodeURIComponent(pathname.slice(i3, i4 - 1));
											if (s4) {
												const i5 = pathname.indexOf('/', i4) + 1;
												if (i5 && i5 !== len) {
													if (pathname.slice(i4, i5 - 1) === 'baz') {
														const i6 = pathname.indexOf('/', i5) + 1;
														if (i6 && i6 !== len) {
															const s6 = decodeURIComponent(pathname.slice(i5, i6 - 1));
															if (s6) {
																const i7 = pathname.indexOf('/', i6) + 1;
																if (!i7 || i7 === len) {
																	const s7 = decodeURIComponent(pathname.slice(i6, i7 ? -1 : len));
																	if (s7) return { handler: get1, params: { fooId: s2, 'bar Id': s4, '1bazId': s6, 'qux-Id': s7 }, meta: {}, path: '/foo/:fooId/bar/:bar Id/baz/:1bazId/:qux-Id' }; // /foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id
																}
															}
														}
													}
												}
											}
										}
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
			const len = pathname.length;
			if (len > 1) {
				const i1 = pathname.indexOf('/', 1) + 1;
				if (i1 && i1 !== len) {
					if (pathname.slice(1, i1 - 1) === 'foo') {
						const i2 = pathname.indexOf('/', 5) + 1;
						if (i2 && i2 !== len) {
							const s2 = decodeURIComponent(pathname.slice(5, i2 - 1));
							if (s2) {
								const i3 = pathname.indexOf('/', i2) + 1;
								if (i3 && i3 !== len) {
									if (pathname.slice(i2, i3 - 1) === 'bar') {
										const i4 = pathname.indexOf('/', i3) + 1;
										if (i4 && i4 !== len) {
											const s4 = decodeURIComponent(pathname.slice(i3, i4 - 1));
											if (s4) {
												const i5 = pathname.indexOf('/', i4) + 1;
												if (i5 && i5 !== len) {
													if (pathname.slice(i4, i5 - 1) === 'baz') {
														const i6 = pathname.indexOf('/', i5) + 1;
														if (i6 && i6 !== len) {
															const s6 = decodeURIComponent(pathname.slice(i5, i6 - 1));
															if (s6) {
																const i7 = pathname.indexOf('/', i6) + 1;
																if (!i7 || i7 === len) {
																	const s7 = decodeURIComponent(pathname.slice(i6, i7 ? -1 : len));
																	if (s7) return { handler: head1, params: { fooId: s2, 'bar Id': s4, '1bazId': s6, 'qux-Id': s7 }, meta: {}, path: '/foo/:fooId/bar/:bar Id/baz/:1bazId/:qux-Id' }; // /foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id
																}
															}
														}
													}
												}
											}
										}
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
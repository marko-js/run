export const patchAccept = "text/marko-patch";
export const patchContentType = "text/javascript";
export const patchResponseContentType = `${patchContentType};charset=UTF-8`;
export const persistedHeaders = {
  build: "x-marko-build",
  from: "x-marko-from",
  route: "x-marko-route",
} as const;

export function createPatchRequestHeaders(
  targetRoute: number,
  fromRoute: number,
  buildId: string,
): Record<string, string> {
  return {
    accept: patchAccept,
    [persistedHeaders.route]: "" + targetRoute,
    [persistedHeaders.from]: "" + fromRoute,
    [persistedHeaders.build]: buildId,
  };
}

export function acceptsPatch(request: Request): boolean {
  return request.headers.get("accept")?.includes(patchAccept) === true;
}

export function matchesPatchRequest(
  request: Request,
  routeId: number,
  buildId: string,
): boolean {
  return (
    request.headers.get(persistedHeaders.route) === "" + routeId &&
    request.headers.get(persistedHeaders.build) === buildId
  );
}

export function isPatchResponse(response: Response): boolean {
  return (
    response.headers.get("content-type")?.includes(patchContentType) === true
  );
}

export function createPatchMismatchResponse(): Response {
  return new Response(null, {
    status: 409,
    headers: { "cache-control": "no-store", vary: "accept" },
  });
}

export function applyPersistedResponseHeaders(
  response: Response,
  patch: boolean,
): Response {
  const { headers } = response;
  if (patch) {
    headers.set("cache-control", "no-store");
    headers.set("content-type", patchResponseContentType);
  }
  const vary = headers.get("vary");
  if (!vary) {
    headers.set("vary", "accept");
  } else if (!/(?:^|,)\s*accept\s*(?:,|$)/i.test(vary)) {
    headers.set("vary", `${vary}, accept`);
  }
  return response;
}

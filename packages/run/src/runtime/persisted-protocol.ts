export const patchAccept = "text/marko-patch";
export const patchContentType = "text/javascript";
export const patchResponseContentType = `${patchContentType};charset=UTF-8`;
export const persistedHeaders = {
  build: "x-marko-build",
  from: "x-marko-from",
  have: "x-marko-have",
  route: "x-marko-route",
} as const;

export function createPatchRequestHeaders(
  targetRoute: number,
  fromRoute: number,
  buildHash: string,
  have: string,
): Record<string, string> {
  return {
    accept: patchAccept,
    [persistedHeaders.route]: "" + targetRoute,
    [persistedHeaders.from]: "" + fromRoute,
    [persistedHeaders.build]: buildHash,
    ...(have && { [persistedHeaders.have]: have }),
  };
}

export function acceptsPatch(request: Request): boolean {
  return request.headers.get("accept")?.includes(patchAccept) === true;
}

export function matchesPatchRequest(
  request: Request,
  routeId: number,
  buildHash: string,
): boolean {
  return (
    request.headers.get(persistedHeaders.route) === "" + routeId &&
    request.headers.get(persistedHeaders.build) === buildHash
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

// Possession echoes may contain arbitrary Unicode loop keys, while fetch
// headers must be byte-safe. Escape to ASCII and omit oversized hints;
// omission is lossy, not fatal -- the server ships authoritative fragments
// for the sites it cannot prove, trading payload bytes for sparse fills.
export function encodeHave(json: string): string {
  if (!json) return json;
  const escaped = json.replace(
    /[-￿]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
  return escaped.length > 4096 ? "" : escaped;
}

export function decodePossessed(
  request: Request,
): Record<string, string> | undefined {
  const have = request.headers.get(persistedHeaders.have);
  if (have) {
    try {
      const parsed = JSON.parse(have);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.assign(
          Object.create(null) as Record<string, string>,
          parsed,
        );
      }
    } catch {
      // A malformed hint degrades to fragment delivery or navigation fallback.
    }
  }
}

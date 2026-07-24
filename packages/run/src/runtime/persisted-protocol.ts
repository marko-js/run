export const patchAccept = "text/marko-patch";
export const patchContentType = "text/javascript";
export const patchResponseContentType = `${patchContentType};charset=UTF-8`;
export const persistedHeaders = {
  build: "x-marko-build",
  echo: "x-marko-echo",
  from: "x-marko-from",
  route: "x-marko-route",
} as const;

/** The possession snapshot a loaded persisted entry exports as `echo`. */
export interface EchoSnapshot {
  regions: Record<string, string>;
}

// The whole HTTP/1 echo field is capped at 511 bytes; name, separator, and
// CRLF cost 16, so the value tops out at 495 (`E1.` + ≤492 of base64url).
const echoValueCap = 495;
const echoPrefix = "E1.";

/** Encodes a patch request's echo: the page's region possessions plus the
 * app's opaque value-section feedback, dropped lowest-benefit-last until
 * the field cap. An omitted entry is a miss, never a lossy summary. The
 * payload is a JSON array today; a binary envelope can succeed it behind
 * the same prefix because JSON always opens with `[`. */
export function encodeEcho(
  snapshot: EchoSnapshot | undefined,
  values: string | undefined,
): string | undefined {
  const regions = snapshot ? Object.entries(snapshot.regions) : [];
  if (!regions.length && !values) return;
  for (let take = regions.length; take >= 0; take--) {
    const value =
      echoPrefix +
      base64UrlEncode(
        JSON.stringify([
          values || 0,
          ...regions.slice(0, take).map(([key, digest]) => key + "|" + digest),
        ]),
      );
    if (value.length <= echoValueCap) return value;
  }
}

/** Decodes a request echo; anything malformed or oversize is a miss. */
export function decodeEcho(value: string | null): {
  values?: string;
  regions?: (site: string, instance: string) => string | undefined;
} | void {
  if (!value || value.length > echoValueCap || !value.startsWith(echoPrefix)) {
    return;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(value.slice(3)));
    if (!Array.isArray(payload)) return;
    const [values, ...entries] = payload;
    let regions: Record<string, string> | undefined;
    for (const entry of entries) {
      if (typeof entry === "string") {
        const digestAt = entry.lastIndexOf("|");
        if (digestAt > 0) {
          // Null-prototype: a hostile "__proto__|…" key must be inert.
          (regions ||= Object.create(null) as Record<string, string>)[
            entry.slice(0, digestAt)
          ] = entry.slice(digestAt + 1);
        }
      }
    }
    return {
      values: typeof values === "string" ? values : undefined,
      regions: regions && ((site, instance) => regions[site + "|" + instance]),
    };
  } catch {
    return;
  }
}

function base64UrlEncode(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

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
  // Belt-and-suspenders under no-store: a shared cache must never key a
  // patch (or the page it varies from) without the negotiation inputs.
  const varies = patch ? ["accept", persistedHeaders.echo] : ["accept"];
  for (const name of varies) {
    const current = headers.get("vary");
    if (!current) headers.set("vary", name);
    else if (!new RegExp(`(?:^|,)\\s*${name}\\s*(?:,|$)`, "i").test(current)) {
      headers.set("vary", `${current}, ${name}`);
    }
  }
  return response;
}

export const patchAccept = "text/marko-patch";
export const patchContentType = "text/javascript";
export const patchResponseContentType = `${patchContentType};charset=UTF-8`;
export const persistedHeaders = {
  build: "x-marko-build",
  /** The claim-set channel rides its own header on both sides, so the
   * echo stays pure E1 grammar and a hedge is byte-identical to today's:
   * request `E2.<id>` (the committed id alone), response
   * `E2.<next-id>;base=empty` or `E2.<next-id>;base=hit|e1;fp=<hash>`
   * (the fingerprint of the exact base consumed). */
  claimSet: "x-marko-claim-set",
  echo: "x-marko-echo",
  from: "x-marko-from",
  route: "x-marko-route",
} as const;

/** The possession snapshot a loaded persisted entry exports as `echo`. */
export interface EchoSnapshot {
  regions: Record<string, string>;
  /** Committed value feedback, pruned to claims the page still holds. */
  values?: string;
}

// Fixed protocol constants — not runtime-configurable. Keep in lockstep
// with marko's DIGEST_WIDTH / VALUE_STORE_CAP / FEEDBACK_CAP.

// The whole HTTP/1 echo field is capped at 511 bytes; name, separator, and
// CRLF cost 16, so the value tops out at 495 (`E1.` + ≤492 of base64url).
const echoValueCap = 495;
const echoPrefix = "E1.";
const claimSetPrefix = "E2.";

/** Claim-set ids are 128-bit CSPRNG, fixed-length base64url: never
 * content-derived (a guessable id names a WRONG store, and wrong claims
 * are silent stale UI). The id grammar is RAW — validated before any
 * decoding, so a percent-encoded lookalike is a miss, never an alias. */
export const claimSetIdLength = 22;

const claimSetRequestPattern = /^E2\.([\w-]{22})$/;
const claimSetAckPattern =
  /^E2\.([\w-]{22});base=(?:(empty)|(hit|e1);fp=([0-9a-z]{1,7}))$/;

/** What the server merged this response's feedback into. The client
 * rebuilds its committed store from exactly this base — and commits the
 * id ONLY when it can prove its own copy of that base:
 * - `hit`: the full store the request's id named; `fp` fingerprints THAT
 *   id, so an ack for some other live id (a replayed header) cannot bind
 *   a store this client never held.
 * - `e1`: exactly the enumerated (post-shed) records the request
 *   carried; `fp` fingerprints the subset the server actually consumed,
 *   so a transport that rewrote the echo cannot bind a divergent store.
 * - `empty`: nothing (cross-route always resolves here). */
export type ClaimSetBase = "hit" | "e1" | "empty";

export function encodeClaimSetRequest(id: string): string {
  return claimSetPrefix + id;
}

/** Decodes the request-side claim-set header; only the exact fixed-length
 * raw grammar yields an id — anything else is a miss, never a throw. */
export function decodeClaimSetRequest(value: string | null): string | void {
  const match = value && claimSetRequestPattern.exec(value);
  if (match) return match[1];
}

export function encodeClaimSetAck(
  id: string,
  base: ClaimSetBase,
  fp?: string,
): string {
  return (
    claimSetPrefix +
    id +
    ";base=" +
    base +
    (base === "empty" ? "" : ";fp=" + fp)
  );
}

/** Decodes a response's claim-set ack; anything malformed means the
 * channel is absent (the client falls back to plain E1 semantics). A
 * base=hit or base=e1 ack without its fingerprint is malformed. */
export function decodeClaimSetAck(
  value: string | null,
): { id: string; base: ClaimSetBase; fp?: string } | void {
  const match = value && claimSetAckPattern.exec(value);
  if (match) {
    return {
      id: match[1],
      base: (match[2] || match[3]) as ClaimSetBase,
      fp: match[4],
    };
  }
}

/** Fingerprint of the acknowledged base: FNV-1a over the exact input the
 * server consumed — the request's claim-set id for a hit, the raw
 * transmitted record subset for e1 — computed identically by server
 * (over what it read) and client (over what it sent). A mismatch means
 * some intermediary rewrote or substituted the request, and the client
 * must not commit the id. */
export function fingerprintValues(values: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < values.length; i++) {
    hash = Math.imul(hash ^ values.charCodeAt(i), 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** The largest value-section feedback a response may carry (kept in
 * lockstep with marko's FEEDBACK_CAP). It deliberately exceeds the `E1.`
 * field cap: the surplus is redeemed whole through a claim-set id, while
 * an E1-only request sheds to `echoValueCap`. Shedding on either path
 * only creates misses, never a broken round-trip. */
export const echoValuesCap = 720;

/** Value feedback rides the patch body as a trailing comment line, so a
 * streamed response never withholds frames to compute it and an applier
 * that sees it executes a no-op. */
export const feedbackLinePrefix = "//E1:";

/** Encodes a patch request's echo: the page's region possessions plus
 * the app's opaque value-claim section, dropped lowest-benefit-first
 * until the field cap — the top region claim outranks the value section,
 * which outranks the remaining claims. An omitted entry is a miss, never
 * a lossy summary. The claim-set id rides its OWN header (see
 * `persistedHeaders.claimSet`), so this envelope is pure E1 and a hedged
 * request's echo is byte-identical to an id-less client's. The `values`
 * return is the transmitted (post-shed) record subset — the client's
 * rebuild base when the server acks `base=e1`. The envelope is raw
 * sections joined by ";" (the value section first, possibly empty), each
 * percent-encoded to a header-safe alphabet — user data rides inside
 * region instances and value keys, and headers reject controls and
 * non-ISO-8859-1. */
export function encodeEcho(
  snapshot: EchoSnapshot | undefined,
  values: string | undefined,
): { header: string; values: string } | undefined {
  const claims = snapshot
    ? Object.entries(snapshot.regions).map(
        ([key, digest]) => key + "|" + digest,
      )
    : [];
  if (!claims.length && !values) return;
  // Benefit rank: claims[0], values, claims[1..] (claims arrive
  // benefit-ordered from the snapshot).
  const valuesRank = values ? Math.min(claims.length, 1) : -1;
  const ranked = claims.length + (values ? 1 : 0);
  for (let take = ranked; take > 0; take--) {
    const keepValues = valuesRank >= 0 && valuesRank < take;
    let value = echoPrefix;
    let sent = "";
    const escapedClaims: string[] = [];
    for (const claim of claims.slice(0, keepValues ? take - 1 : take)) {
      escapedClaims.push(";" + escapeSection(claim));
    }
    if (keepValues) {
      // Budget the value section by its FINAL encoded length, record by
      // record: escaping can multiply a record's size (one code point
      // reaches twelve characters), and an atomic section would drop
      // every claim because one record overflowed.
      let budget =
        echoValueCap - echoPrefix.length - escapedClaims.join("").length;
      for (const record of values!.split(".")) {
        const escaped = (sent ? "." : "") + escapeSection(record);
        if (escaped.length > budget) continue;
        budget -= escaped.length;
        value += escaped;
        sent += (sent && ".") + record;
      }
    }
    value += escapedClaims.join("");
    if (value.length <= echoValueCap) return { header: value, values: sent };
  }
}

/** Decodes a request echo; anything malformed or oversize is a miss. */
export function decodeEcho(value: string | null): {
  values?: string;
  regions?: (token: string) => string | undefined;
} | void {
  if (!value || value.length > echoValueCap || !value.startsWith(echoPrefix)) {
    return;
  }
  try {
    const [values, ...entries] = value
      .slice(echoPrefix.length)
      .split(";")
      .map(unescapeSection);
    let regions: Record<string, string> | undefined;
    for (const entry of entries) {
      // `token|digest`; a token is opaque, so only the last separator splits.
      const digestAt = entry.lastIndexOf("|");
      if (digestAt > 0) {
        // Null-prototype: a hostile "__proto__|…" key must be inert.
        (regions ||= Object.create(null) as Record<string, string>)[
          entry.slice(0, digestAt)
        ] = entry.slice(digestAt + 1);
      }
    }
    return {
      values: values || undefined,
      regions: regions && ((token) => regions[token]),
    };
  } catch {
    return;
  }
}

// Header-safe section codec: visible ASCII passes through except the
// escape and separator characters; everything else percent-encodes as
// UTF-8 bytes.
function escapeSection(section: string) {
  let out = "";
  for (const char of section) {
    const code = char.codePointAt(0)!;
    if (code > 0x20 && code < 0x7f && char !== "%" && char !== ";") {
      out += char;
    } else {
      for (const byte of new TextEncoder().encode(char)) {
        out += "%" + byte.toString(16).padStart(2, "0");
      }
    }
  }
  return out;
}

function unescapeSection(section: string) {
  return section.indexOf("%") < 0 ? section : decodeURIComponent(section);
}

// Mirrors marko's DIGEST_WIDTH; exported so both repos' suites pin the
// same number and drift fails a test.
export const digestWidth = 16;

/** Committed-store entry cap, mirrored in marko's `VALUE_STORE_CAP`. */
export const valueStoreCap = 256;

/** Merges a response's delta value feedback into the committed store:
 * absent entries mean keep; capped at 256 entries, oldest first. Kept in
 * sync with marko's common/value-claims helper. */
export function mergeValueFeedback(
  committed: string | undefined,
  feedback: string,
) {
  if (!committed) return feedback;
  const byKey = new Map<string, string>();
  for (const entry of committed.split(".")) {
    byKey.set(entry.slice(0, -digestWidth), entry);
  }
  for (const entry of feedback.split(".")) {
    const key = entry.slice(0, -digestWidth);
    byKey.delete(key);
    byKey.set(key, entry);
  }
  let out = "";
  let over = byKey.size - valueStoreCap;
  for (const entry of byKey.values()) {
    if (over-- > 0) continue;
    out += (out && ".") + entry;
  }
  return out;
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
  // A negotiation rejection is not a patch (the client distinguishes by
  // content-type), but it is just as personalized: same cache contract.
  return applyPatchCacheHeaders(new Response(null, { status: 409 }));
}

/** A patch — or a rejection of one — answers this client's possessions,
 * so it is categorically uncacheable (including by CDNs, whose own
 * directives override `cache-control`) and keys on every negotiation
 * input its body varies with. A partial cache key is worse than none. */
function applyPatchCacheHeaders(response: Response) {
  const { headers } = response;
  headers.set("cache-control", "private, no-store");
  headers.set("cdn-cache-control", "no-store");
  for (const name of [
    "accept",
    persistedHeaders.echo,
    persistedHeaders.claimSet,
    persistedHeaders.build,
    persistedHeaders.route,
    persistedHeaders.from,
  ]) {
    const current = headers.get("vary");
    if (!current) headers.set("vary", name);
    else if (!new RegExp(`(?:^|,)\\s*${name}\\s*(?:,|$)`, "i").test(current)) {
      headers.set("vary", `${current}, ${name}`);
    }
  }
  return response;
}

export function applyPersistedResponseHeaders(
  response: Response,
  patch: boolean,
): Response {
  const { headers } = response;
  if (patch) {
    headers.set("content-type", patchResponseContentType);
    return applyPatchCacheHeaders(response);
  }
  // The document a patch varies from keys on the negotiation it answers.
  if (!headers.get("vary")) headers.set("vary", "accept");
  else if (!/(?:^|,)\s*accept\s*(?:,|$)/i.test(headers.get("vary")!)) {
    headers.set("vary", `${headers.get("vary")}, accept`);
  }
  return response;
}

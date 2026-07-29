/// <reference types="vite/client" />

import {
  createPatchRequestHeaders,
  decodeClaimSetAck,
  type EchoSnapshot,
  encodeClaimSetRequest,
  encodeEcho,
  feedbackLinePrefix,
  fingerprintValues,
  isPatchResponse,
  mergeValueFeedback,
  persistedHeaders,
} from "./persisted-protocol.js";

/** The deferred persisted module for one route. */
export interface PersistedEntry {
  patch: (fail?: (error: unknown) => void) => (source: string) => true | string;
  /** The page's provable possessions, echoed on the next patch request:
   * live regions, plus the committed value feedback pruned to claims the
   * page can still dispatch into. */
  echo: (values?: string) => EchoSnapshot;
}

/** Build-stable route id plus its lazy persisted entry. */
export type RouteEntry = [
  id: number,
  loadPersisted: () => Promise<PersistedEntry>,
];

export type RouteMatcher = (pathname: string) => RouteEntry | undefined;

export type Mutation = [
  body: FormData | URLSearchParams,
  form: HTMLFormElement,
  submitter: HTMLElement | null,
];

export interface NavigationState {
  appliedUrl: string;
  buildId: string;
  controller?: AbortController;
  currentId: number;
  resubmitting?: boolean;
  /** The applied page's possession snapshot (set once its entry applied). */
  echo?: (values?: string) => EchoSnapshot;
  /** The server's opaque value-digest feedback, committed only after the
   * response that carried it fully applied. */
  echoValues?: string;
  /** The server-issued id naming `echoValues` in its claim-set map,
   * committed with the store it names and dropped whenever the two could
   * disagree (pruning changed the store, or a partial apply diverged). */
  claimSetId?: string;
  /** A stream applied frames but has not finished: if it is superseded,
   * the live page has diverged from the committed claims. */
  partialApply?: boolean;
}

// Ids are authored decoded while URL fragments arrive percent-encoded;
// malformed sequences fall back to the raw fragment like browsers do.
function decodeFragment(fragment: string) {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

type Fallback = (
  err: unknown,
  href: string,
  push: boolean,
  mutation?: Mutation,
  response?: Response,
) => void;

export async function navigate(
  state: NavigationState,
  href: string,
  push: boolean,
  target: RouteEntry,
  mutation: Mutation | undefined,
  fallback: Fallback,
) {
  const targetId = target[0];
  // Only a cross-route link/form navigation may recover focus after it
  // applies; same-route patches (validation re-renders) never move focus.
  const knownAutofocus =
    push && targetId !== state.currentId
      ? new Set<Element>(document.querySelectorAll("[autofocus]"))
      : undefined;
  // The departing entry's scroll is captured at initiation, before applied
  // frames can clamp it.
  const startX = scrollX;
  const startY = scrollY;
  // GETs can be aborted. Mutations may already have reached the server, so
  // only supersede their application.
  state.controller?.abort();
  // Claims must describe the live page: a superseded partial apply left it
  // diverged from the last committed feedback, so value claims — and the
  // id naming them — drop before this navigation snapshots its echo.
  // (Regions re-snapshot live state.)
  if (state.partialApply) {
    state.partialApply = false;
    state.echoValues = undefined;
    state.claimSetId = undefined;
  }
  const { signal } = (state.controller = new AbortController());
  let response: Response | undefined;
  let applied = false;
  let failed = false;
  // Terminal fallback once the page changed: load the document at the
  // navigation's final URL with GET (a mutation is never resubmitted).
  // The DOM no longer matches anything the committed claims (or the id
  // naming them) describe — even an already-committed {id, store} from
  // this navigation's EOF — so both drop synchronously, before the
  // replacement load and before any later navigation could echo them.
  const replaceDocument = (err: unknown) => {
    failed = true;
    state.claimSetId = undefined;
    state.echoValues = undefined;
    console.warn("@marko/run: persisted navigation fell back", err);
    location.replace(response!.url || href);
  };

  try {
    const loading = target[1]();
    const headers = createPatchRequestHeaders(
      targetId,
      state.currentId,
      state.buildId,
    );
    // The echo asserts only what the applied page provably holds; a page
    // whose entry never applied a patch has nothing to assert. Value
    // claims pass through the snapshot so dead-anchor claims drop — and
    // the committed store follows the prune, so the entry cap only ever
    // evicts among live holds.
    const priorStore = state.echoValues;
    const snapshot = state.echo?.(priorStore);
    if (snapshot && priorStore !== undefined) {
      state.echoValues = snapshot.values || undefined;
    }
    // The id names the committed store only while liveness pruning agrees:
    // a prune that changed ANYTHING (dead anchor, unbacked group, parked
    // lazy delivery) would let the id assert content the page no longer
    // holds, so it drops and the pruned enumerated form rides alone.
    if (state.claimSetId && (!snapshot || snapshot.values !== priorStore)) {
      state.claimSetId = undefined;
    }
    // Hedged hybrid: the id rides its own header beside the untouched E1
    // echo, so an instance that never saw the id (fleet, restart) reads a
    // request byte-identical to an id-less client's.
    const sentId = state.claimSetId;
    const sentStore = sentId ? state.echoValues : undefined;
    if (sentId) {
      headers[persistedHeaders.claimSet] = encodeClaimSetRequest(sentId);
    }
    const echo = encodeEcho(snapshot, snapshot?.values);
    // What actually crossed the wire (post-shed): the rebuild base when
    // the server acks base=e1.
    const sentValues = echo?.values || undefined;
    if (echo) headers[persistedHeaders.echo] = echo.header;
    const crossRoute = targetId !== state.currentId;
    const fetching = fetch(href, {
      method: mutation && "POST",
      body: mutation?.[0],
      headers,
      signal: mutation ? undefined : signal,
    });
    let entry: PersistedEntry;
    if (mutation) {
      // Once sent, the POST may commit server-side: settle the fetch and let
      // its response drive fallback; resubmitting is only safe before one.
      loading.catch(() => {});
      response = await fetching;
      entry = await loading;
    } else {
      [entry, response] = await Promise.all([loading, fetching]);
    }
    if (signal.aborted) return void response.body?.cancel();

    // Patch MIME, rather than status, distinguishes validation patch
    // responses; the echoed build id proves the body is this build's patch
    // stream and not other same-origin script content a redirect landed on.
    if (
      !isPatchResponse(response) ||
      response.headers.get(persistedHeaders.build) !== state.buildId
    ) {
      throw new Error(
        import.meta.env.DEV
          ? `expected this build's patch response (${response.status})`
          : String(response.status),
      );
    }

    // The server's claim-set ack (read early, committed only after EOF +
    // full apply): the reserved next id plus the exact base this response
    // merged from. Absent or malformed means the channel is off.
    const claimSet = decodeClaimSetAck(
      response.headers.get(persistedHeaders.claimSet),
    );

    // A lazy module the applied patch needs can fail to load after this
    // navigation resolved (deploy skew), leaving the page partially updated;
    // an aborted signal means a newer navigation owns the page instead.
    const applyPatch = entry.patch((err) => {
      if (!signal.aborted) replaceDocument(err);
    });
    const markApplied = () => {
      // Advance on the first applied frame (or a completed zero-fill
      // stream); later failure replaces this entry.
      applied = true;
      state.partialApply = true;
      // The snapshot is a live view of possession — safe to adopt as soon
      // as this entry owns the page, even if the stream later aborts.
      state.echo = entry.echo;
      // Under merge semantics the committed value store is route-scoped:
      // a route change clears it wholesale (anchor-liveness pruning only
      // covers same-route disappearances).
      if (state.currentId !== targetId) state.echoValues = undefined;
      state.currentId = targetId;
      const url = new URL(response!.url || href);
      // fetch drops fragments; like a redirect without its own fragment,
      // the navigation keeps the original one.
      url.hash ||= new URL(href).hash;
      const nextUrl = url.pathname + url.search;
      const samePage = nextUrl === state.appliedUrl;
      state.appliedUrl = nextUrl;
      if (push && !samePage) {
        saveScroll(startX, startY);
        history.pushState(null, "", url.href);
        const anchor =
          url.hash &&
          document.getElementById(decodeFragment(url.hash.slice(1)));
        if (anchor) anchor.scrollIntoView();
        else scrollTo(0, 0);
      }
    };
    const applyLine = (line: string) => {
      if (!line) return;
      applyPatch(line);
      if (!applied) markApplied();
    };

    // Apply newline-delimited serializer frames in arrival order. The
    // final `//E1:` comment line is the server's value-section feedback —
    // inert to the script applier by shape, parsed here instead of
    // applied — and doubles as the completion marker, so it terminates the
    // body: anything after it belongs to no render this client asked for
    // and is never applied.
    let feedback: string | undefined;
    let trailing = false;
    const consumeLine = (line: string) => {
      if (feedback === undefined && line.startsWith(feedbackLinePrefix)) {
        feedback = line.slice(feedbackLinePrefix.length);
      } else if (line) {
        if (feedback === undefined) applyLine(line);
        else trailing = true;
      }
    };
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) return void reader.cancel();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) consumeLine(line);
      if (done) {
        consumeLine(buffer);
        break;
      }
    }

    // A mid-stream apply failure already handed the page to a document
    // replacement; nothing below may run, least of all a commit.
    if (failed) return;
    // The footer is the completion marker: this build's server writes it
    // LAST on every successful patch (an all-held body as the bare
    // `//E1:` line), so a body that ended without it — or carried content
    // after it — was truncated or rewritten in transit. Frames that
    // already applied left the page diverged from every committed claim,
    // exactly as a mid-stream error does: drop {id, store} and replace
    // the document. With nothing applied there is nothing to salvage and
    // nothing yet diverged, so the navigation falls back to a document
    // load instead of advancing to a page that never arrived.
    if (feedback === undefined || trailing) {
      const truncated = new Error("truncated patch stream");
      if (applied) return void replaceDocument(truncated);
      throw truncated;
    }
    // A completed stream with zero apply lines is a patch that changed
    // nothing (every group and region held): the navigation still applied,
    // as a no-op — adopt the entry and advance exactly as a filled frame
    // would have.
    if (!applied) markApplied();
    // Value feedback commits only after every frame applied: it must never
    // assert digests for fills a superseded stream never ran. (A superseding
    // navigation aborts this one mid-stream and simply forgoes the update.)
    // Feedback is a DELTA merged into the committed store — an absent line
    // (or entry) means keep; an empty line is not a clear.
    state.partialApply = false;
    // The client commits only an ack it can PROVE names its own store:
    // both non-empty bases carry the fingerprint of what the server
    // consumed, and it must match what THIS request sent — the id itself
    // for `hit` (a replayed header naming another live id acks that id's
    // fingerprint, and binds a store this page never held), the exact
    // transmitted record subset for `e1`. Cross-route supports only
    // `empty` (marko refuses cross-route claims; the server acks
    // accordingly). Anything else — divergent, impossible, or absent —
    // discards the id and keeps plain E1 merge semantics: bytes, never
    // staleness.
    if (
      claimSet &&
      (claimSet.base === "empty" ||
        (!crossRoute &&
          (claimSet.base === "hit"
            ? sentId !== undefined && claimSet.fp === fingerprintValues(sentId)
            : sentValues !== undefined &&
              claimSet.fp === fingerprintValues(sentValues))))
    ) {
      // Rebuild from exactly the acknowledged base — the full store the
      // sent id named (hit), the transmitted enumerated subset (e1), or
      // nothing — then commit {id, store} together.
      const base =
        claimSet.base === "hit"
          ? sentStore
          : claimSet.base === "e1"
            ? sentValues
            : undefined;
      state.echoValues =
        (feedback ? mergeValueFeedback(base, feedback) : base) || undefined;
      state.claimSetId = claimSet.id;
    } else {
      // No ack (kill switch, stripped header, older server) or an
      // unprovable one: plain E1 semantics — merge into the local store
      // and hold no id.
      state.claimSetId = undefined;
      if (feedback) {
        state.echoValues = mergeValueFeedback(state.echoValues, feedback);
      }
    }
    if (!push) {
      // Any browser restore targeted the pre-patch DOM; land the traversal
      // on the position recorded when this entry was last departed.
      const recorded = history.state?.[scrollStateKey];
      if (Array.isArray(recorded)) scrollTo(recorded[0], recorded[1]);
      else scrollTo(0, 0);
    }
    if (knownAutofocus) {
      const active = document.activeElement;
      if (!active || active === document.body) {
        let arrived: Element | undefined;
        for (const el of document.querySelectorAll("[autofocus]")) {
          if (!knownAutofocus.has(el)) {
            arrived = el;
            break;
          }
        }
        // The patch removed the focused element (or none was focused): land
        // on arriving autofocus content, else body to announce from the top.
        ((arrived || document.body) as HTMLElement).focus();
      }
    }
    dispatchEvent(new CustomEvent("marko-run:navigate"));
  } catch (err) {
    if (signal.aborted) return;
    if (applied) {
      // Replace the advanced entry after a partial apply fails.
      replaceDocument(err);
      return;
    }
    // A frame is not atomic: an unapplied one can still have mutated the DOM
    // before it threw, leaving the page past what the committed claims
    // describe. Drop them before the fallback is scheduled — clearing on a
    // failure that touched nothing only costs a colder next request.
    state.claimSetId = undefined;
    state.echoValues = undefined;
    fallback(err, href, push, mutation, response);
  }
}

// Scroll positions ride per-entry history state under a namespaced key so
// traversals can land where the entry was left; app state merges untouched.
const scrollStateKey = "marko-run:scroll";

function saveScroll(x: number, y: number) {
  const appState = history.state;
  if (typeof appState === "object" && !Array.isArray(appState)) {
    history.replaceState({ ...appState, [scrollStateKey]: [x, y] }, "");
  }
}

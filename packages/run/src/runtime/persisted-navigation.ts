/// <reference types="vite/client" />

import {
  createPatchRequestHeaders,
  type EchoSnapshot,
  encodeEcho,
  isPatchResponse,
  persistedHeaders,
} from "./persisted-protocol.js";

/** The deferred persisted module for one route. */
export interface PersistedEntry {
  patch: (fail?: (error: unknown) => void) => (source: string) => true | string;
  /** The page's provable possessions, echoed on the next patch request. */
  echo: () => EchoSnapshot;
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
  echo?: () => EchoSnapshot;
  /** The server's opaque value-digest feedback, committed only after the
   * response that carried it fully applied. */
  echoValues?: string;
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
  const { signal } = (state.controller = new AbortController());
  let response: Response | undefined;
  let applied = false;
  // Terminal fallback once the page changed: load the document at the
  // navigation's final URL with GET (a mutation is never resubmitted).
  const replaceDocument = (err: unknown) => {
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
    // whose entry never applied a patch has nothing to assert.
    const echo = encodeEcho(state.echo?.(), state.echoValues);
    if (echo) headers[persistedHeaders.echo] = echo;
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

    // A lazy module the applied patch needs can fail to load after this
    // navigation resolved (deploy skew), leaving the page partially updated;
    // an aborted signal means a newer navigation owns the page instead.
    const applyPatch = entry.patch((err) => {
      if (!signal.aborted) replaceDocument(err);
    });
    const applyLine = (line: string) => {
      if (!line) return;
      applyPatch(line);
      if (!applied) {
        // Advance on the first applied frame; later failure replaces this entry.
        applied = true;
        // The snapshot is a live view of possession — safe to adopt as soon
        // as this entry owns the page, even if the stream later aborts.
        state.echo = entry.echo;
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
      }
    };

    // Apply newline-delimited serializer frames in arrival order.
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) return void reader.cancel();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) applyLine(line);
      if (done) {
        applyLine(buffer);
        break;
      }
    }

    if (!applied) {
      throw new Error(
        import.meta.env.DEV ? "patch response carried no fills" : undefined,
      );
    }
    // Value feedback commits only after every frame applied: it must never
    // assert digests for fills a superseded stream never ran. (A superseding
    // navigation aborts this one mid-stream and simply forgoes the update.)
    const feedback = response.headers.get(persistedHeaders.echo);
    if (feedback !== null) state.echoValues = feedback || undefined;
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

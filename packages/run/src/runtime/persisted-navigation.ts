/// <reference types="vite/client" />

import {
  createPatchRequestHeaders,
  encodeHave,
  isPatchResponse,
} from "./persisted-protocol.js";

/** The generated update module for one route. */
export interface UpdateEntry {
  createPatch: () => (source: string) => boolean;
  /** The renderer held at each live dynamic-tag hop. */
  have?: () => string;
}

/** Build-stable route id plus lazy template and update entries. */
export type RouteEntry = [
  id: number,
  loadTemplate: () => Promise<unknown>,
  loadUpdate: () => Promise<UpdateEntry>,
];

export type RouteMatcher = (pathname: string) => RouteEntry | null;

export type Mutation = [
  body: FormData | URLSearchParams,
  form: HTMLFormElement,
  submitter: HTMLElement | null,
];

export interface NavigationState {
  appliedUrl: string;
  buildHash: string;
  controller?: AbortController;
  currentId: number;
  resubmitting?: boolean;
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
  // GETs can be aborted. Mutations may already have reached the server, so
  // only supersede their application.
  state.controller?.abort();
  const { signal } = (state.controller = new AbortController());
  let response: Response | undefined;
  let applied = false;

  try {
    // Load the update entry before fetch so its compact possession echo can be
    // sent with the request. Cross-route template registration remains parallel
    // with the network.
    const entry = await target[2]();
    const have = encodeHave(entry.have?.() || "");
    const [fetched] = await Promise.all([
      fetch(href, {
        method: mutation && "POST",
        body: mutation?.[0],
        headers: createPatchRequestHeaders(
          targetId,
          state.currentId,
          state.buildHash,
          have,
        ),
        signal: mutation ? undefined : signal,
      }),
      targetId === state.currentId ? undefined : target[1](),
    ]);
    response = fetched;
    if (signal.aborted) return void response.body?.cancel();

    // Status is intentionally not the discriminator: validation responses may
    // be non-2xx patches. A protocol/build/route mismatch returns non-patch
    // content and takes the ordinary-navigation fallback.
    if (!isPatchResponse(response)) {
      throw new Error(
        import.meta.env.DEV
          ? `unexpected update response (${response.status})`
          : String(response.status),
      );
    }

    const applyPatch = entry.createPatch();
    const applyLine = (line: string) => {
      if (!line) return;
      if (!applyPatch(line)) return;
      if (!applied) {
        // Advancing on the first frame means an abort mid-stream leaves
        // `x-marko-from` claiming the full target against a partially patched
        // page; the server then finds nothing to merge and the zero-fill
        // response falls back to a full navigation.
        applied = true;
        state.currentId = targetId;
        const url = new URL(response!.url || href);
        // fetch drops fragments; like a redirect without its own fragment,
        // the navigation keeps the original one.
        url.hash ||= new URL(href).hash;
        const nextUrl = url.pathname + url.search;
        const samePage = nextUrl === state.appliedUrl;
        state.appliedUrl = nextUrl;
        if (push && !samePage) {
          history.pushState(null, "", url.href);
          const anchor = url.hash && document.getElementById(url.hash.slice(1));
          if (anchor) anchor.scrollIntoView();
          else scrollTo(0, 0);
        }
      }
    };

    // Each newline is one serializer frame. Apply synchronous HTML state as
    // soon as it arrives, then merge later async boundary frames in order.
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
        import.meta.env.DEV ? "update response carried no fills" : undefined,
      );
    }
    dispatchEvent(new CustomEvent("marko-run:navigate"));
  } catch (err) {
    if (signal.aborted) return;
    if (applied) {
      // The page already advanced history for this navigation; replace so a
      // partially updated document doesn't leave a duplicate entry behind.
      console.warn("@marko/run: persisted navigation fell back", err);
      location.replace(response!.url || href);
      return;
    }
    fallback(err, href, push, mutation, response);
  }
}

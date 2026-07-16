/// <reference types="vite/client" />

import {
  createPatchRequestHeaders,
  isPatchResponse,
} from "./persisted-protocol.js";

/** The deferred persisted module for one route. */
export interface PersistedEntry {
  patch: () => (source: string) => true | string;
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
  have: string;
  resubmitting?: boolean;
}

function applyHave(current: string, metadata: string) {
  if (metadata[1] === "=") return metadata.slice(2);
  const separator = metadata.indexOf(".", 2);
  return (
    current.slice(0, parseInt(metadata.slice(2, separator), 36)) +
    metadata.slice(separator + 1)
  );
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
    const [entry, nextResponse] = await Promise.all([
      target[1](),
      fetch(href, {
        method: mutation && "POST",
        body: mutation?.[0],
        headers: createPatchRequestHeaders(
          targetId,
          state.currentId,
          state.buildId,
          state.have,
        ),
        signal: mutation ? undefined : signal,
      }),
    ]);
    response = nextResponse;
    if (signal.aborted) return void response.body?.cancel();

    // Patch MIME, rather than status, distinguishes validation patch responses.
    if (!isPatchResponse(response)) {
      throw new Error(
        import.meta.env.DEV
          ? `unexpected update response (${response.status})`
          : String(response.status),
      );
    }

    const applyPatch = entry.patch();
    const applyLine = (line: string) => {
      if (!line) return;
      const result = applyPatch(line);
      if (typeof result === "string")
        state.have = applyHave(state.have, result);
      if (!applied) {
        // Advance on the first applied frame; later failure replaces this entry.
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
        import.meta.env.DEV ? "update response carried no fills" : undefined,
      );
    }
    dispatchEvent(new CustomEvent("marko-run:navigate"));
  } catch (err) {
    if (signal.aborted) return;
    if (applied) {
      // Replace the advanced entry after a partial apply fails.
      console.warn("@marko/run: persisted navigation fell back", err);
      location.replace(response!.url || href);
      return;
    }
    fallback(err, href, push, mutation, response);
  }
}

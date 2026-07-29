import { buildIdHeader, patchContentType } from "../vite/constants";
import { href } from "./url-builder";

/** A frame the server refuses to produce; the document navigation is the answer. */
const REFUSED = "0";

/** Nothing may park forever waiting for a patch that can never arrive. */
const PATCH_TIMEOUT_MS = 3000;

if (typeof window !== "undefined") {
  (window as any).Run ||= { href };
  installPatchNavigation(window);
}

/**
 * Turns same-origin anchor and GET-form navigation into a patch request, falling
 * back to a document navigation whenever a patch cannot be proven to apply.
 * Takes its window so it can be driven against a test realm.
 */
export function installPatchNavigation(win: Window & typeof globalThis) {
  const applyPatch = (win as any).__marko_apply_patch__ as
    | undefined
    | ((frame: string) => boolean);
  // Only a persisted build exposes an applier; without one there is nothing to
  // intercept and the browser keeps doing ordinary document navigation.
  if (!applyPatch) return;

  const buildId: string = (win as any).__MARKO_RUN_BUILD_ID__ || "dev";
  // Every navigation gets an epoch; a response that arrives after a later one
  // started is dropped rather than applied out of order.
  let epoch = 0;
  // A route that cannot be patched in this build never can be, so it is asked
  // once; without this every navigation would pay a wasted round trip.
  const refusedPaths = new Set<string>();
  // A hash change fires popstate too; only a different path or query is a
  // navigation the server has anything new to say about.
  let current = target(win.location.href);

  win.document.addEventListener("click", onClick);
  win.document.addEventListener("submit", onSubmit as EventListener);
  win.addEventListener("popstate", onPopState);

  function onClick(event: MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const anchor = (event.target as Element | null)?.closest?.("a");
    if (!anchor) return;

    const attr = anchor.getAttribute("href");
    if (
      !attr ||
      attr.startsWith("#") ||
      (anchor as HTMLAnchorElement).target ||
      anchor.hasAttribute("download") ||
      anchor.getAttribute("rel")?.includes("external")
    ) {
      return;
    }

    const url = candidate((anchor as HTMLAnchorElement).href);
    if (!url) return;

    event.preventDefault();
    navigate(url, "push");
  }

  // A GET form is a navigation spelled differently. A POST is left to the
  // browser: its handler has already run by the time a frame could be refused,
  // and a second request to recover would run the mutation twice.
  function onSubmit(event: SubmitEvent) {
    if (event.defaultPrevented) return;

    const form = event.target as HTMLFormElement;
    const submitter = event.submitter as
      | null
      | (HTMLElement & {
          formMethod?: string;
          formAction?: string;
        });
    const method = (
      submitter?.formMethod ||
      form.method ||
      "get"
    ).toLowerCase();
    if (method !== "get" || form.enctype === "multipart/form-data") return;

    const url = candidate(submitter?.formAction || form.action);
    if (!url) return;

    url.search = new win.URLSearchParams(
      [...new win.FormData(form, submitter)].filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ).toString();

    event.preventDefault();
    navigate(url, "push");
  }

  function onPopState() {
    const url = sameOrigin(win.location.href);
    if (!url || target(url.href) === current) return;
    current = target(url.href);
    // A popstate cannot be cancelled, so a refused route reloads to stay honest.
    if (refusedPaths.has(url.pathname)) return win.location.reload();
    navigate(url, "replace");
  }

  function target(href: string) {
    const url = sameOrigin(href);
    return url ? url.pathname + url.search : href;
  }

  function candidate(href: string) {
    const url = sameOrigin(href);
    return url && !refusedPaths.has(url.pathname) ? url : undefined;
  }

  function sameOrigin(href: string) {
    try {
      const url = new win.URL(href, win.location.href);
      return url.origin === win.location.origin ? url : undefined;
    } catch {
      return undefined;
    }
  }

  async function navigate(url: URL, mode: "push" | "replace") {
    const started = ++epoch;
    const patch = await requestPatch(url);
    if (!patch) return fallback(url);
    // A redirect (post-redirect-get, a trailing-slash rewrite) means the patch
    // describes a different URL than the one asked for.
    const { settled, frames } = patch;

    // A superseded navigation must not touch the document it no longer describes.
    if (started !== epoch) return;

    for (const frame of frames) {
      if (frame === REFUSED || !applyPatch!(frame)) {
        refusedPaths.add(settled.pathname);
        return fallback(url);
      }
    }

    current = target(settled.href);
    win.history[mode === "push" ? "pushState" : "replaceState"](
      null,
      "",
      settled,
    );
  }

  async function requestPatch(url: URL) {
    try {
      const response = await win.fetch(url, {
        headers: { accept: patchContentType, [buildIdHeader]: buildId },
        signal: win.AbortSignal.timeout(PATCH_TIMEOUT_MS),
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith(patchContentType)
      ) {
        return;
      }

      return {
        settled: sameOrigin(response.url) || url,
        frames: (await response.text()).split("\n").filter(Boolean),
      };
    } catch {
      return;
    }
  }

  function fallback(url: URL) {
    win.location.assign(String(url));
  }
}

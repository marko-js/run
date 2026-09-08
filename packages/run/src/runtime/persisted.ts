/** Marko's `patch($global)`: the request headers to send and the frame apply. */
type Patch = ($global?: {
  runtimeId?: string;
}) => readonly [
  headers: Record<string, string>,
  apply: (frame: string) => boolean | Promise<boolean>,
];
/** Page routes, most specific first: a matcher and the route's client code. */
type Routes = [RegExp, () => Promise<unknown>][];
type Entry = Routes[number][1];

const PATCH_CONTENT_TYPE = "text/marko-patch";

let patch: Patch | undefined;
let routes: Routes;
let $global: { runtimeId?: string } | undefined;
let current: string;
let epoch = 0;
let inflight: AbortController | undefined;

/**
 * Turns links and forms to page routes into patch requests that update the
 * live document; anything that is not a patch becomes a document load.
 * Installs once: a route's entry loaded for a patch must not re-install.
 */
export function router(
  page: Patch,
  pageRoutes: Routes,
  global?: { runtimeId?: string },
) {
  if (patch) return;
  patch = page;
  routes = pageRoutes;
  $global = global;
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  current = location.pathname + location.search;
  addEventListener("popstate", () => {
    // A hash-only move stays; a URL no route serves reloads.
    if (current === location.pathname + location.search) return;
    const entry = matchEntry(location);
    if (entry) navigate(new Request(location.href), entry, 1);
    else location.reload();
  });
}

function onClick(ev: MouseEvent) {
  if (
    ev.defaultPrevented ||
    ev.button ||
    ev.metaKey ||
    ev.ctrlKey ||
    ev.shiftKey ||
    ev.altKey
  ) {
    return;
  }
  const anchor = (ev.target as Element).closest?.("a[href]");
  if (!anchor || anchor.hasAttribute("download") || !isSelfTarget(anchor)) {
    return;
  }
  const url = new URL(anchor.getAttribute("href")!, location.href);
  const entry = isLocal(url) && matchEntry(url);
  if (!entry || (url.hash && isCurrentDocument(url))) return;
  ev.preventDefault();
  navigate(new Request(url), entry);
}

function onSubmit(ev: SubmitEvent) {
  if (ev.defaultPrevented) return;
  const form = ev.target as HTMLFormElement;
  const submitter = ev.submitter;
  const attr = (name: string) =>
    submitter?.getAttribute("form" + name) ?? form.getAttribute(name);
  const method = (attr("method") || "GET").toUpperCase();
  const url = new URL(attr("action") || "", location.href);
  const entry = isLocal(url) && matchEntry(url);
  if (
    !entry ||
    !isSelfTarget(form, submitter) ||
    (method !== "GET" && method !== "POST")
  ) {
    return;
  }
  const data = new FormData(form, submitter || undefined);
  ev.preventDefault();
  if (method === "GET") {
    url.search = "" + new URLSearchParams(data as unknown as string[][]);
    navigate(new Request(url), entry);
  } else {
    const multipart = attr("enctype") === "multipart/form-data";
    navigate(
      new Request(url, {
        method,
        body: multipart
          ? data
          : new URLSearchParams(data as unknown as string[][]),
      }),
      entry,
    );
  }
}

async function navigate(request: Request, entry: Entry, pop?: 1) {
  const run = ++epoch;
  inflight?.abort();
  const { signal } = (inflight = new AbortController());
  // The route's client code loads alongside the fetch, not after it.
  let ready = entry();
  // Marko's own account of what the live page holds rides its headers.
  const [headers, apply] = patch!($global);
  request.headers.set("accept", PATCH_CONTENT_TYPE);
  for (const name in headers) request.headers.set(name, headers[name]);
  let response: Response;
  try {
    response = await fetch(request, { signal });
  } catch {
    if (run === epoch) location.assign(request.url);
    return;
  }
  if (run !== epoch) return;
  // Anything but a patch is the document at the landed URL. A non-GET
  // that answered with a document loads it as a GET (a redirect's target,
  // or the route's page again).
  if (
    !/^text\/javascript\b/i.test(response.headers.get("content-type") || "") ||
    !response.body
  ) {
    return location.assign(response.url);
  }
  // A redirect may land on another page route.
  const landed = matchEntry(new URL(response.url));
  if (landed && landed !== entry) ready = landed();
  await applyFrames(
    readFrames(response.body),
    apply,
    run,
    ready,
    // The document changes only once the first frame applies, so a
    // superseded navigation never records an entry (as a native one).
    () => {
      const landedUrl = new URL(response.url);
      current = landedUrl.pathname + landedUrl.search;
      if (!pop) {
        history.pushState(null, "", response.url);
        scrollTo(0, 0);
      } else if (current !== location.pathname + location.search) {
        history.replaceState(null, "", response.url);
      }
    },
    () => location.assign(response.url),
  );
}

// Frames apply as they arrive once the route's client code is loaded; a
// frame that does not apply faithfully ends the navigation as a document.
async function applyFrames(
  frames: AsyncIterable<string>,
  apply: (frame: string) => boolean | Promise<boolean>,
  run: number,
  ready: Promise<unknown> | undefined,
  commit: () => void,
  fail: () => void,
) {
  const settle = (applied: boolean) => {
    if (!applied && run === epoch) fail();
  };
  try {
    await ready;
    for await (const frame of frames) {
      if (run !== epoch) return;
      commit();
      commit = () => {};
      const applied = apply(frame);
      if (applied === false) return fail();
      if (applied !== true) applied.then(settle, () => settle(false));
    }
  } catch {
    settle(false);
  }
}

async function* readFrames(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffered += decoder.decode(value, { stream: !done });
    let end: number;
    while ((end = buffered.indexOf("\n")) >= 0) {
      const frame = buffered.slice(0, end);
      buffered = buffered.slice(end + 1);
      if (frame) yield frame;
    }
    if (done) {
      if (buffered) yield buffered;
      return;
    }
  }
}

function matchEntry(url: { pathname: string }) {
  const path = url.pathname.replace(/(.)\/$/, "$1");
  for (const [pattern, entry] of routes) {
    if (pattern.test(path)) return entry;
  }
}

function isLocal(url: URL) {
  return url.origin === location.origin && /^https?:$/.test(url.protocol);
}

function isCurrentDocument(url: URL) {
  return url.pathname === location.pathname && url.search === location.search;
}

function isSelfTarget(el: Element, submitter?: HTMLElement | null) {
  const target =
    submitter?.getAttribute("formtarget") ?? el.getAttribute("target");
  return !target || target === "_self";
}

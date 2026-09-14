/**
 * The live page's side of a patch, as marko's `patch($global)` gives it: the
 * request headers to send and the frame apply.
 */
type Patch = () => readonly [
  headers: Record<string, string>,
  apply: (frame: string) => boolean | Promise<boolean>,
];
interface Navigation {
  /** A history traversal: the entry exists, its scroll position is restored. */
  pop?: 1;
  /** The fragment the link or form action named. */
  hash?: string;
  /** The form a mutation came from, resubmitted natively if the request fails. */
  form?: HTMLFormElement;
  submitter?: HTMLElement | null;
}
type ScrollState = { s?: [number, number] } | null;

const PATCH_CONTENT_TYPE = "text/marko-patch";
/** The frame that closes a patch stream (`context.render`); its absence is a truncated stream. */
export const PATCH_END = "//";

let patch: Patch | undefined;
let pages: RegExp;
let build: string;
let preloads: [RegExp, (() => Promise<unknown>)[]][];
let current: string;
let epoch = 0;
let inflight: AbortController | undefined;
let resubmitting = false;

/**
 * Turns links and forms to pages into patch requests that update the live
 * document; anything that is not a patch becomes a document load. The app
 * template installs it from its own scope, once.
 */
export function router(
  page: Patch,
  pagePaths: RegExp,
  buildId: string,
  pageLoads: typeof preloads = [],
) {
  if (patch) return;
  patch = page;
  pages = pagePaths;
  build = buildId;
  preloads = pageLoads;
  history.scrollRestoration = "manual";
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  addEventListener("popstate", onPopState);
  addEventListener("pagehide", () => inflight?.abort());
  current = location.pathname + location.search;
}

function onPopState() {
  // A hash-only move stays; a URL no page serves reloads.
  if (current === location.pathname + location.search) return;
  if (isPage(location)) navigate(new Request(location.href), { pop: 1 });
  else location.reload();
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
  if (
    !anchor ||
    anchor.hasAttribute("download") ||
    isExternal(anchor) ||
    !isSelfTarget(anchor)
  ) {
    return;
  }
  const href = anchor.getAttribute("href")!;
  const url = new URL(href, location.href);
  // A fragment of the current document is the browser's own scroll.
  if (
    !isLocal(url) ||
    !isPage(url) ||
    (href.includes("#") && isCurrentDocument(url))
  ) {
    return;
  }
  ev.preventDefault();
  navigate(new Request(url), { hash: url.hash });
}

function onSubmit(ev: SubmitEvent) {
  if (ev.defaultPrevented || resubmitting) return;
  const form = ev.target as HTMLFormElement;
  const submitter = ev.submitter;
  const attr = (name: string) =>
    submitter?.getAttribute("form" + name) ?? form.getAttribute(name);
  const method = (attr("method") || "GET").toUpperCase();
  const enctype = attr("enctype");
  const url = new URL(attr("action") || "", location.href);
  if (
    !isLocal(url) ||
    !isPage(url) ||
    isExternal(form) ||
    !isSelfTarget(form, submitter) ||
    (method !== "GET" && method !== "POST") ||
    enctype === "text/plain"
  ) {
    return;
  }
  const data = new FormData(form, submitter || undefined);
  const hash = url.hash;
  if (method === "GET") {
    // A file has no query form; the browser submits it its own way.
    for (const value of data.values()) if (typeof value !== "string") return;
    ev.preventDefault();
    url.search = "" + new URLSearchParams(data as unknown as string[][]);
    navigate(new Request(url), { hash });
  } else {
    ev.preventDefault();
    navigate(
      new Request(url, {
        method,
        body:
          enctype === "multipart/form-data"
            ? data
            : new URLSearchParams(data as unknown as string[][]),
      }),
      { hash, form, submitter },
    );
  }
}

async function navigate(request: Request, nav: Navigation) {
  const run = ++epoch;
  const mutation = request.method !== "GET";
  // A mutation runs to completion even when a later navigation supersedes
  // it (only its response is dropped); a read is abandoned.
  inflight?.abort();
  inflight = mutation ? undefined : new AbortController();
  if (!nav.pop) saveScroll();
  // The page's lazy modules load alongside the request (a failure is the
  // frame's to report when it needs them).
  const pathname = decodeURIComponent(new URL(request.url).pathname).replace(
    /(.)\/$/,
    "$1",
  );
  for (const [pathPattern, loads] of preloads) {
    if (pathPattern.test(pathname)) {
      for (const load of loads) load().catch(() => {});
    }
  }
  // Marko's own account of what the live page holds rides its headers.
  const [headers, apply] = patch!();
  request.headers.set("accept", PATCH_CONTENT_TYPE);
  request.headers.set("x-marko-patch", build);
  for (const name in headers) request.headers.set(name, headers[name]);
  let response: Response;
  try {
    response = await fetch(request, { signal: inflight?.signal });
  } catch {
    if (run !== epoch) return;
    // A mutation that never answered submits natively, so a redirect the
    // fetch could not follow still lands; a read loads its document.
    if (nav.form) resubmit(nav.form, nav.submitter);
    else location.assign(request.url);
    return;
  }
  if (run !== epoch) return;
  // Only a patch this build produced applies; anything else (another
  // build's, any method) is the document at the landed URL.
  if (response.headers.get("x-marko-patch") !== build || !response.body) {
    warnFallback(
      `the response is not this page's build (${response.headers.get("x-marko-patch")} vs ${build})`,
    );
    return location.assign(response.url);
  }
  let committed = false;
  const target = new URL(response.url);
  target.hash = nav.hash || "";
  const applied = await applyFrames(readFrames(response.body), apply, run, {
    // The document changes only once the first frame applies, so a
    // superseded navigation never records an entry (as a native one).
    commit() {
      committed = true;
      current = target.pathname + target.search;
      if (nav.pop) {
        if (current !== location.pathname + location.search) {
          history.replaceState(history.state, "", target.href);
        }
        const saved = (history.state as ScrollState)?.s;
        if (saved) scrollTo(saved[0], saved[1]);
      } else {
        history.pushState(null, "", target.href);
        if (!nav.hash) scrollTo(0, 0);
      }
    },
    fail() {
      if (committed) location.replace(response.url);
      else location.assign(response.url);
    },
  });
  if (applied && nav.hash && !nav.pop) scrollToHash(nav.hash);
}

// Frames apply as they arrive; a frame that does not apply faithfully, or a
// stream cut before its closing frame, ends the navigation as a document.
async function applyFrames(
  frames: AsyncIterable<string>,
  apply: (frame: string) => boolean | Promise<boolean>,
  run: number,
  on: { commit(): void; fail(): void },
) {
  let ended = false;
  let failed = false;
  // Frames a module load defers: they apply in order on their own, and
  // the navigation succeeds only once every one of them has.
  const pending: Promise<boolean>[] = [];
  const fail = (why: string) => {
    if (!failed && run === epoch) {
      failed = true;
      warnFallback(why);
      on.fail();
    }
  };
  try {
    for await (const frame of frames) {
      if (run !== epoch) return false;
      if (frame === PATCH_END) {
        ended = true;
        continue;
      }
      if (ended) return (fail("a frame followed the end"), false);
      on.commit();
      on.commit = () => {};
      const applied = apply(frame);
      if (applied === false) return (fail("a frame did not apply"), false);
      if (applied !== true) {
        pending.push(
          applied.then(
            (ok) => ok || (fail("a deferred frame did not apply"), false),
            () => (fail("a deferred frame threw"), false),
          ),
        );
      }
    }
  } catch {
    ended = false;
  }
  if (!ended)
    return (fail("the stream ended without its closing frame"), false);
  for (const applied of pending) if (!(await applied)) return false;
  return run === epoch;
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

// The departing entry keeps its scroll position for a later traversal.
function saveScroll() {
  const state = history.state as ScrollState;
  history.replaceState(
    {
      ...(state && typeof state === "object" ? state : {}),
      s: [scrollX, scrollY],
    },
    "",
  );
}

function scrollToHash(hash: string) {
  const id = decodeURIComponent(hash.slice(1));
  (
    document.getElementById(id) || document.getElementsByName(id)[0]
  )?.scrollIntoView();
}

// The browser's own submission, past this router once.
function resubmit(form: HTMLFormElement, submitter?: HTMLElement | null) {
  resubmitting = true;
  try {
    form.requestSubmit(submitter || undefined);
  } finally {
    resubmitting = false;
  }
}

// Pages match as the server does: a decoded path with no trailing slash.
function isPage(url: { pathname: string }) {
  try {
    return pages.test(decodeURIComponent(url.pathname).replace(/(.)\/$/, "$1"));
  } catch {
    return false;
  }
}

function isLocal(url: URL) {
  return url.origin === location.origin && /^https?:$/.test(url.protocol);
}

function isCurrentDocument(url: URL) {
  return url.pathname === location.pathname && url.search === location.search;
}

function isExternal(el: Element) {
  return /(^|\s)external(\s|$)/.test(el.getAttribute("rel") || "");
}

function isSelfTarget(el: Element, submitter?: HTMLElement | null) {
  const target =
    submitter?.getAttribute("formtarget") ?? el.getAttribute("target");
  return !target || target === "_self";
}

// Dev builds say why a patch navigation became a document load.
function warnFallback(why: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`A patch navigation fell back to a document load: ${why}.`);
  }
}

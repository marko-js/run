/**
 * The live page's side of a patch, as marko's `patch($global)` gives it: the
 * request headers to send and the apply for the response, which reads its
 * frames and reports through each callback. A `replay` keeps the page's token.
 */
type Patch = (
  signal: AbortSignal,
  replay?: unknown,
) => readonly [
  headers: Record<string, string>,
  apply: (
    response: Response,
    onCommit: () => void,
    onApplied: () => void,
    onEnd: () => void,
    onFail: () => void,
  ) => void,
];
/** A navigation; its one letter names stay short in the router's bundle. */
interface Navigation {
  /** Pop: a history traversal's key of the entry it arrived at. */
  p?: number;
  /** Scroll: where a traversal's entry was when it was last shown. */
  s?: Scroll;
  /** Hash: the fragment the link, form action or traversed entry named. */
  h?: string;
  /** Form: the submitted one, reset as its page commits (a document's are
   * fresh) and resubmitted natively if the request fails. */
  f?: HTMLFormElement;
  /** Button: the form's submitter. */
  b?: HTMLElement | null;
  /** Committed: marko changed the page, so its entry is recorded. */
  c?: 1;
  /** At: where its scroll last left the page, to tell a user's scroll. */
  a?: number;
  /** Done: its scroll landed or gave way to the user's. */
  d?: unknown;
  /** Focused: its `[autofocus]` control took focus, once as a document load's. */
  o?: 1;
  /** Its controller: aborting it stops the request and the response. */
  x?: AbortController | null;
}
type Scroll = [x: number, y: number];
/** The router's part of a history entry's state. */
interface EntryState {
  /** Names the entry, so a traversal finds where it was scrolled. */
  k?: number;
}

let patch: Patch | undefined;
let pages: RegExp;
/** Paths only a handler answers: a read there may redirect to a page. */
let handlers: RegExp | undefined;
let current: string;
/** The key of the entry the page shows. */
let entry: number;
/**
 * Where each entry was scrolled, kept in the session (as `$MR`) for a reload
 * or a traversal from another document.
 */
let scrolls: Record<number, Scroll> = {};
/** The document's own `overflow-anchor` while a restore holds anchoring off. */
let anchoring: string | null | undefined;
/** The navigation under way: a later one, a traversal or a failure ends it. */
let active: Navigation | null | undefined;
/** Whether the shown page's response ended, rather than being cut. */
let whole: unknown = 1;
/**
 * The last response of each entry that ended whole, replayed on a traversal
 * back to it as a back/forward cache would (memory only, as held shells are).
 */
const kept = new Map<number, Response>();
/** This document's entries in session order, as far as it knows them. */
let order: number[];
/** The browser's own action under way (a resubmission, a fragment), let pass. */
let native: unknown;

/**
 * Turns links and forms to pages into patch requests that update the live
 * document; anything that is not a patch becomes a document load. The app
 * template installs it from its own scope, once.
 */
export function router(page: Patch, pagePaths: RegExp, handlerPaths?: RegExp) {
  if (patch) return;
  patch = page;
  pages = pagePaths;
  handlers = handlerPaths;
  history.scrollRestoration = "manual";
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  addEventListener("popstate", onPopState);
  addEventListener("pagehide", () => {
    if (!active?.f) active?.x?.abort();
    saveScroll();
    try {
      sessionStorage.$MR = JSON.stringify(scrolls);
    } catch {
      // Without storage, a reload starts at the top.
    }
  });
  current = documentOf(location);
  try {
    scrolls = JSON.parse(sessionStorage.$MR);
  } catch {
    // Nothing kept yet, or no storage.
  }
  const { k = Math.random() } = getState();
  const scroll = scrolls[k];
  setKey((entry = k));
  order = [k];
  // A reload or a traversal from another document returns to where it was,
  // again once the page has loaded.
  if (scroll) {
    const restore = (active = { s: scroll });
    scrollEntry(restore);
    addEventListener(
      "load",
      () => (scrollEntry(restore), scrollEntry(restore, 1)),
    );
  }
}

function onPopState() {
  if (native) return;
  const { k } = getState();
  const pop = k || Math.random();
  const scroll = scrolls[pop];
  // A new fragment's entry gets its key here, pushed as the browser pushed
  // it; the browser scrolls to it.
  if (!k) push(setKey(pop));
  if (current === documentOf(location)) {
    // A traversal within the shown document stops a navigation that has not
    // committed; one that has is this document's, which streams on.
    if (k && !active?.c) {
      active?.x?.abort();
      active = null;
      holdAnchoring(0);
    }
    saveScroll();
    entry = pop;
    if (scroll) scrollTo(...scroll);
    // A traversal away cut the shown page's response: it loads in place again.
    if (k && !whole && !active) {
      navigate(location, { p: pop, s: [scrollX, scrollY] });
    }
  } else {
    navigate(location, { p: pop, s: scroll });
  }
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
    !isPage(url, true) ||
    (href.includes("#") && documentOf(url) === documentOf(location))
  ) {
    return;
  }
  ev.preventDefault();
  navigate(url, {});
}

function onSubmit(ev: SubmitEvent) {
  if (ev.defaultPrevented || native) return;
  const form = ev.target as HTMLFormElement;
  const submitter = ev.submitter;
  const attr = (name: string) =>
    submitter?.getAttribute("form" + name) ?? form.getAttribute(name);
  const method = (attr("method") || "GET").toUpperCase();
  const enctype = attr("enctype");
  const url = new URL(attr("action") || "", location.href);
  if (
    !isLocal(url) ||
    !isPage(url, method === "GET") ||
    isExternal(form) ||
    !isSelfTarget(form, submitter) ||
    (method !== "GET" && method !== "POST")
  ) {
    return;
  }
  const data = new FormData(form, submitter);
  const query = new URLSearchParams(data as unknown as string[][]);
  if (method === "GET") {
    // A file has no query form; the browser submits it its own way.
    for (const value of data.values()) if (typeof value !== "string") return;
    url.search = query as unknown as string;
  }
  ev.preventDefault();
  navigate(
    url,
    { f: form, b: submitter },
    method === "GET"
      ? undefined
      : enctype === "multipart/form-data"
        ? data
        : query,
  );
}

// A form's body makes it a mutation (a POST).
async function navigate(url: URL | Location, nav: Navigation, body?: BodyInit) {
  const { href } = url;
  nav.h = url.hash;
  holdAnchoring(0);
  // Stopping a navigation stops its request and its response.
  active?.x?.abort();
  active = nav;
  const { signal } = (nav.x = new AbortController());
  // A read of the URL shown replaces its entry, as a browser does.
  const replace = !body && href === location.href;
  // A traversal to a kept entry replays its response and requests nothing.
  const replay = nav.p && kept.get(nav.p);
  // Marko's headers name the page's build and what it holds.
  const [headers, apply] = patch!(signal, replay);
  let response: Response;
  let key: number;
  try {
    response = replay
      ? replay.clone()
      : await fetch(href, { method: body && "POST", body, headers, signal });
  } catch {
    // A form that never answered submits natively, so a redirect the fetch
    // could not follow still lands; a link loads its document.
    if (nav.f && nav === active) resubmit(nav.f, nav.b);
    else load(nav, href);
    return;
  }
  // A 204 or 205 leaves the page as it is, as a browser's navigation does.
  if ((response.status | 1) === 205) return;
  const target = new URL(response.url);
  target.hash = nav.h;
  // A response is kept once it ends whole, a mutation's too (as a browser's
  // back/forward cache keeps the page a form landed on); a replay stays kept.
  const copy = replay || response.clone();
  apply(
    response,
    // The document changes only once the first frame applies (a held one
    // once its modules land), so a superseded navigation records no entry.
    () => {
      // A document load starts with focus at the document.
      (document.activeElement as HTMLElement).blur();
      whole = nav.f?.reset();
      nav.c = 1;
      current = documentOf(target);
      saveScroll();
      if (nav.p) {
        key = entry = nav.p;
        if (current !== documentOf(location)) {
          history.replaceState(history.state, "", target.href);
        }
      } else {
        // A replace keeps the shown entry, but not its kept response.
        if (replace) kept.delete((key = entry));
        else push((key = Math.random()));
        history[replace ? "replaceState" : "pushState"](
          { k: (entry = key) },
          "",
          target.href,
        );
      }
    },
    () => scrollEntry(nav),
    () => {
      // Nothing is left to stop, and an abort now errors the kept copy.
      nav.x = null;
      if (copy) {
        // The most recently ended entries stay kept, ten at most.
        kept.delete(key);
        if (kept.set(key, copy).size > 10)
          kept.delete(kept.keys().next().value!);
      }
      scrollEntry(nav, (whole = 1));
    },
    // A stale build is refused before any handler ran, so a form submits
    // natively; any other failure loads the landed URL's document.
    () =>
      response.status === 412 && nav.f
        ? resubmit(nav.f, nav.b)
        : load(nav, response.url),
  );
}

/**
 * A document load in place of the navigation under way, which it ends: a
 * traversal reloads the entry it arrived at, and a committed one replaces its
 * entry rather than adding one.
 */
function load(nav: Navigation, url: string) {
  if (nav !== active) return;
  active = null;
  if (nav.p) location.reload();
  else if (nav.c) location.replace(url);
  else location.assign(url);
}

/**
 * Scrolls the arriving entry as content applies, as a document load does: a
 * traversal to where it was, else to its fragment's target, else to the top.
 * It retries as frames apply until it lands, the user scrolls or it `end`s.
 */
function scrollEntry(nav: Navigation, end?: 1) {
  if (nav !== active) return;
  const target = !nav.s && nav.h && hashTarget(nav.h);
  if (end || nav.d || (nav.a !== undefined && nav.a !== scrollY)) {
    // A fragment with no element target (a text fragment) is searched once
    // content ends, as a browser does after a load.
    if (end && nav.h && !nav.s && !nav.d && nav.a === scrollY)
      toFragment(nav.h);
    nav.d = 1;
  } else {
    if (target) toFragment(nav.h!);
    else scrollTo(...(nav.s || [0, 0]));
    nav.a = scrollY;
    nav.d = target || (nav.s ? nav.a + 1 > nav.s[1] : !nav.h);
  }
  // A load focuses its `[autofocus]` control once, unless focus moved or a
  // fragment names a target; a traversal keeps what it restores.
  if (!nav.p && !nav.o && !target && document.activeElement === document.body) {
    const control = document.querySelector<HTMLElement>("[autofocus]");
    if (control) {
      nav.o = 1;
      control.focus();
    }
  }
  holdAnchoring(!nav.d);
}

// Scroll anchoring moves the page as content streams in above where it is,
// which a restore would read as the user scrolling: it waits the restore out.
function holdAnchoring(hold: unknown) {
  const { style } = document.documentElement;
  if (hold) {
    anchoring ??= style.overflowAnchor;
    style.overflowAnchor = "none";
  } else if (anchoring != null) {
    style.overflowAnchor = anchoring;
    anchoring = null;
  }
}

// The browser's own fragment navigation, as a document does on finding the
// target: it scrolls, sets `:target` and moves focus; the entry keeps its key.
function toFragment(hash: string) {
  native = 1;
  location.replace(hash);
  native = 0;
  setKey(entry);
}

function hashTarget(hash: string) {
  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // A fragment that is not UTF-8 names its target as written.
  }
  return document.getElementById(id) || document.getElementsByName(id)[0];
}

// The shown entry's position, for a later traversal to it.
function saveScroll() {
  scrolls[entry] = [scrollX, scrollY];
}

function getState(): EntryState {
  const { state } = history;
  return state && typeof state === "object" ? state : {};
}

// Keys the shown entry, keeping the rest of its state.
function setKey(k: number) {
  const state = getState();
  state.k = k;
  history.replaceState(state, "");
  return k;
}

// A push discards the entries ahead of the shown one, as the browser does,
// and their kept responses (an unknown shown entry precedes every known one).
function push(key: number) {
  for (const gone of order.splice(order.indexOf(entry) + 1, Infinity, key)) {
    kept.delete(gone);
  }
}

// The browser's own submission, past this router once.
function resubmit(form: HTMLFormElement, submitter?: HTMLElement | null) {
  native = 1;
  try {
    form.requestSubmit(submitter);
  } catch {
    // The page removed its submitter meanwhile: the form submits without it.
    form.requestSubmit();
  } finally {
    native = 0;
  }
}

// Pages match as the server does: a decoded path with no trailing slash. A
// read also patches through a handler, landing where it redirects.
function isPage(url: { pathname: string }, read?: boolean) {
  try {
    const path = decodeURIComponent(url.pathname).replace(/(.)\/$/, "$1");
    return pages.test(path) || (!!read && !!handlers?.test(path));
  } catch {
    return false;
  }
}

function isLocal(url: URL) {
  return url.origin === location.origin;
}

// What names a document: its path and query, not its fragment.
function documentOf(url: URL | Location) {
  return url.pathname + url.search;
}

function isExternal(el: Element) {
  return /(^|\s)external(\s|$)/.test(el.getAttribute("rel") || "");
}

function isSelfTarget(el: Element, submitter?: HTMLElement | null) {
  const target =
    submitter?.getAttribute("formtarget") ?? el.getAttribute("target");
  return !target || target === "_self";
}

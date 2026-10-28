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
   * fresh) and resubmitted natively if another build refuses it. */
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
  /** Leaving: after `beforeunload` a failure before the next frame is the
   * browser stopping the page's loads (Firefox does), which leaves it as is. */
  l?: unknown;
}
type Scroll = [x: number, y: number];
/** The router's part of a history entry's state. */
interface EntryState {
  /** Names the entry, so a traversal finds where it was scrolled. */
  k?: number;
}

let patch: Patch | undefined;
let routes: RegExp;
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
 * back to it as a back/forward cache would (memory only, as held shells are),
 * until a mutation's page commits.
 */
const kept = new Map<number, Response>();
/** This document's entries in session order, as far as it knows them. */
let order: number[];
/** The browser's own action under way (a resubmission, a fragment), let pass. */
let native: unknown;
/** Where the browser last reported the page scrolled, which a new fragment's
 * entry saves for the entry it left. */
let atX: number;
let atY: number;

/**
 * Turns links and forms to routes into patch requests that update the live
 * document; anything that is not a patch becomes a document load. The app
 * template installs it from its own scope, once.
 */
export function router(page: Patch, routePaths: RegExp) {
  if (patch) return;
  patch = page;
  routes = routePaths;
  history.scrollRestoration = "manual";
  atX = scrollX;
  atY = scrollY;
  addEventListener("scroll", (_: Event) => {
    atX = scrollX;
    atY = scrollY;
  });
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  addEventListener("popstate", onPopState);
  addEventListener("beforeunload", (_: Event) => active && (active.l = 1));
  addEventListener("pagehide", (_: Event) => {
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
    addEventListener("load", (_: Event) => {
      scrollEntry(restore);
      scrollEntry(restore, 1);
    });
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
  // A new fragment while a navigation is under way (from app code it runs)
  // is an entry of the page shown, whatever its URL, and never navigates.
  if (current === documentOf(location) || (!k && active?.x)) {
    // A traversal within the shown document stops a navigation that has not
    // committed; one that has is this document's, which streams on.
    if (k && !active?.c) {
      active?.x?.abort();
      active = null;
      holdAnchoring(0);
    }
    // The browser may scroll to a new fragment before its popstate (Firefox
    // does), so the entry it left keeps where the page was last reported.
    if (k) saveScroll();
    else scrolls[entry] = [atX, atY];
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
    !isRoute(url) ||
    (/#/.test(href) && documentOf(url) === documentOf(location))
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
  const get = method === "GET";
  const url = new URL(attr("action") || "", location.href);
  if (
    !isLocal(url) ||
    !isRoute(url) ||
    isExternal(form) ||
    !isSelfTarget(form, submitter) ||
    (!get && method !== "POST")
  ) {
    return;
  }
  const data = new FormData(form, submitter);
  // A multipart POST sends the form data itself; anything else, its query.
  const body =
    !get && /^m/i.test(attr("enctype")!)
      ? data
      : new URLSearchParams(data as unknown as string[][]);
  if (get) {
    url.search = body as unknown as string;
  }
  ev.preventDefault();
  navigate(url, { f: form, b: submitter }, get ? undefined : body);
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
    // Same-origin, by path (patched pages don't support `<base>`); a redirect
    // elsewhere comes back in-band, and a final bare `~` keys it apart in caches.
    response =
      replay ||
      (await fetch(documentOf(url) + (url.search ? "&~" : "?~"), {
        method: body && "POST",
        body,
        headers,
        signal,
        mode: "same-origin",
      }));
  } catch {
    // A mutation may have run before its fetch failed, so it is never sent
    // again and the page stays as it was; a read loads its document.
    if (!body) load(nav, href);
    else if (nav === active) active = null;
    return;
  }
  // A 204 or 205 keeps the page shown, as a browser does; a traversal has
  // already moved the URL, so it returns to the shown entry (a link has no `p`).
  if ((response.status | 1) === 205) {
    nav.x = null;
    const at = order.indexOf(nav.p!);
    const back = order.indexOf(entry) - at;
    if (~at && back) history.go(back);
    return;
  }
  // The server marks a redirect within the origin as the router marks a request.
  const landed = response.url.replace(/[?&]~$/, "");
  const target = new URL(landed);
  target.hash = nav.h;
  apply(
    // A copy applies, so the response is kept once it ends whole, a mutation's
    // too (as a browser's back/forward cache keeps the page a form landed on).
    response.clone(),
    // The document changes only once the first frame applies (a held one
    // once its modules land), so a superseded navigation records no entry.
    (_?: never) => {
      // A document load starts with focus at the document.
      (document.activeElement as HTMLElement).blur();
      // The form's own reset, which a control named `reset` shadows.
      whole = nav.f && HTMLFormElement.prototype.reset.call(nav.f);
      nav.c = 1;
      // A mutation (a logout, say) may change what every kept page showed.
      if (body) kept.clear();
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
    // A frame that applies shows the browser did not stop the response.
    (_?: never) => (nav.l = scrollEntry(nav)),
    (_?: never) => {
      // Nothing is left to stop, and an abort now errors the kept response.
      nav.x = null;
      // The most recently ended entries stay kept, ten at most.
      kept.delete(key);
      if (kept.set(key, response).size > 10)
        kept.delete(kept.keys().next().value!);
      scrollEntry(nav, (whole = 1));
    },
    // A 412 is taken for another build's refusal, so a form submits natively;
    // anything else loads where it landed.
    (_?: never) =>
      body && response.status === 412
        ? resubmit(nav.f!, nav.b)
        : load(nav, response.headers.get("location") || landed),
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
  // A URL naming no fragment keeps the navigation's, as a redirect does.
  if (!/#/.test(url)) url += nav.h;
  if (nav.l) holdAnchoring(0);
  else if (nav.p) location.reload();
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
  // fragment names a target, even one yet to arrive; a traversal does not.
  if (
    !nav.p &&
    !nav.o &&
    !target &&
    (!nav.h || end) &&
    document.activeElement === document.body
  ) {
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

// Routes match as the server does, on the decoded path. A handler with no
// page is assumed to redirect to one, so it patches too.
function isRoute(url: { pathname: string }) {
  try {
    return routes.test(decodeURIComponent(url.pathname));
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
  return /(^|\s)external(\s|$)/i.test(el.getAttribute("rel") || "");
}

function isSelfTarget(el: Element, submitter?: HTMLElement | null) {
  const target =
    submitter?.getAttribute("formtarget") ?? el.getAttribute("target");
  return !target || target === "_self";
}

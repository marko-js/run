/** Whether a frame applied: truthy when it did. */
type Applied = 0 | 1;
/**
 * The live page's side of a patch, as marko's `patch($global)` gives it: the
 * request headers to send and the frame apply, which answers with a promise
 * when the frame waits on the page.
 */
type Patch = () => readonly [
  headers: Record<string, string>,
  apply: (frame: string) => Applied | Promise<Applied>,
];
interface Navigation {
  /** A history traversal: the key of the entry it arrived at. */
  pop?: number;
  /** Where a traversal's entry was scrolled when it was last shown. */
  scroll?: Scroll;
  /** The fragment the link, form action or traversed entry named. */
  hash?: string;
  /** The form a mutation came from, resubmitted natively if the request fails. */
  form?: HTMLFormElement;
  submitter?: HTMLElement | null;
  /** A mutation's URL and body until its response commits: a repeat is not sent. */
  sent?: string;
}
type Scroll = [x: number, y: number];
/**
 * The stylesheets a build's pages link for their lazy modules: every href,
 * then each page's (by branch) as indexes into them.
 */
type Styles = [hrefs: string[], pages: number[][]];
/** The router's part of a history entry's state. */
interface EntryState {
  /** Names the entry, so a traversal finds where it was scrolled. */
  k?: number;
}

const PATCH_CONTENT_TYPE = "text/marko-patch";
/**
 * The session's record of where each entry was scrolled, for a reload or a
 * traversal from another document.
 */
const SCROLLS = "marko-run-scrolls";
/** A stylesheet linked ahead of its page's content loads but does not apply. */
const INERT = "not all";
/** The frame that closes a patch stream (`context.render`); its absence is a truncated stream. */
export const PATCH_END = "//";

let patch: Patch | undefined;
let pages: RegExp;
let build: string;
let preloads: [RegExp, (() => Promise<unknown>)[], page?: number][];
let styles: Styles | undefined;
/** The stylesheets this router linked, each until it loads. */
const sheets = new WeakMap<Element, Promise<unknown>>();
let current: string;
/** The key of the entry the page shows. */
let entry: number;
let scrolls: Record<number, Scroll> = {};
let epoch = 0;
/** The document's own `overflow-anchor` while a restore holds anchoring off. */
let anchoring: string | undefined;
let active: Navigation | undefined;
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
  pageStyles?: Styles,
) {
  if (patch) return;
  patch = page;
  pages = pagePaths;
  build = buildId;
  preloads = pageLoads;
  styles = pageStyles && [
    pageStyles[0].map((href) => new URL(href, location.href).href),
    pageStyles[1],
  ];
  history.scrollRestoration = "manual";
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  addEventListener("popstate", onPopState);
  addEventListener("pagehide", () => {
    inflight?.abort();
    saveScroll();
    try {
      sessionStorage[SCROLLS] = JSON.stringify(scrolls);
    } catch {
      // Without storage, a reload starts at the top.
    }
  });
  current = location.pathname + location.search;
  try {
    scrolls = JSON.parse(sessionStorage[SCROLLS]);
  } catch {
    // Nothing kept yet, or no storage.
  }
  const { k = Math.random() } = getState();
  const scroll = scrolls[k];
  setState({ k: (entry = k) });
  // A reload or a traversal from another document returns to where it was,
  // again once the page has loaded.
  if (scroll) {
    const restore = scroller({ scroll }, epoch);
    restore();
    addEventListener("load", () => (restore(), restore(1)));
  }
}

function onPopState() {
  const { k } = getState();
  const pop = k || Math.random();
  const scroll = scrolls[pop];
  // A new fragment's entry gets its key here; the browser scrolls to it.
  if (!k) setState({ k: pop });
  if (current === location.pathname + location.search) {
    if (k) {
      ++epoch;
      inflight?.abort();
      holdAnchoring(0);
    }
    saveScroll();
    entry = pop;
    if (scroll) scrollTo(scroll[0], scroll[1]);
  } else if (isPage(location)) {
    navigate(new Request(location.href), { pop, scroll, hash: location.hash });
  } else location.reload();
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
    const params = new URLSearchParams(data as unknown as string[][]);
    const sent = url + "\n" + params;
    // The submission in flight is not sent again for a repeat of it (a double
    // click), as a browser does; a different one supersedes it.
    if (active?.sent === sent) return;
    navigate(
      new Request(url, {
        method,
        body: enctype === "multipart/form-data" ? data : params,
      }),
      { hash, form, submitter, sent },
    );
  }
}

async function navigate(request: Request, nav: Navigation) {
  const run = ++epoch;
  holdAnchoring(0);
  active = nav;
  const mutation = request.method !== "GET";
  // A read of the URL shown replaces its entry, as a browser does.
  const replace = !mutation && request.url === location.href;
  // A mutation runs to completion even when a later navigation supersedes
  // it (only its response is dropped); a read is abandoned.
  inflight?.abort();
  inflight = mutation ? undefined : new AbortController();
  // The page's lazy modules load alongside the request (a failure is the
  // frame's to report when it needs them).
  const pathname = decodeURIComponent(new URL(request.url).pathname).replace(
    /(.)\/$/,
    "$1",
  );
  const loading: unknown[] = [];
  for (const [pathPattern, loads, index] of preloads) {
    if (pathPattern.test(pathname)) {
      // Its stylesheets link first: a bundler's loader finds them and adds none.
      linkStyles(stylesOf(index));
      for (const load of loads) loading.push(load().catch(() => {}));
    }
  }
  // Marko's own account of what the live page holds rides its headers;
  // its `x-marko-patch` follows the build id, `<build>;<held>`.
  const [headers, apply] = patch!();
  request.headers.set("accept", PATCH_CONTENT_TYPE);
  for (const name in headers) request.headers.set(name, headers[name]);
  request.headers.set(
    "x-marko-patch",
    build + ";" + (headers["x-marko-patch"] || ""),
  );
  let response: Response;
  try {
    response = await fetch(request, { signal: inflight?.signal });
  } catch {
    if (run !== epoch) return;
    // A mutation that never answered submits natively, so a redirect the
    // fetch could not follow still lands; a read loads its document.
    if (nav.form) resubmit(nav.form, nav.submitter);
    else load(nav, request.url);
    return;
  }
  if (run !== epoch) return;
  // Only a patch this build produced applies, whatever its status (a 404 or
  // 500 page answers as one); anything else is the document at the landed URL.
  if (
    response.headers.get("x-marko-patch") !== build ||
    !/^text\/javascript/.test(response.headers.get("content-type")!) ||
    !response.body
  ) {
    if (process.env.NODE_ENV !== "production") {
      warnFallback(
        `the response is not a patch of this page's build (${response.headers.get("x-marko-patch")} vs ${build}, ${response.headers.get("content-type")})`,
      );
    }
    return load(nav, response.url);
  }
  // The page the server rendered names its stylesheets; frames apply once
  // they and the lazy modules load.
  let swap = stylesOf(response.headers.get("x-marko-page"));
  loading.push(...linkStyles(swap));
  await Promise.all(loading);
  if (run !== epoch) return;
  let committed = false;
  const target = new URL(response.url);
  target.hash = nav.hash || "";
  const scroll = scroller(nav, run);
  await applyFrames(readFrames(response.body), apply, run, {
    // The document changes only once the first frame applies, so a
    // superseded navigation never records an entry (as a native one).
    commit() {
      committed = true;
      nav.sent = undefined;
      current = target.pathname + target.search;
      saveScroll();
      if (nav.pop) {
        entry = nav.pop;
        if (current !== location.pathname + location.search) {
          history.replaceState(history.state, "", target.href);
        }
      } else {
        history[replace ? "replaceState" : "pushState"](
          { k: (entry = Math.random()) },
          "",
          target.href,
        );
      }
    },
    applied() {
      // The first frame replaced the page's content (a part a module load
      // defers included): its stylesheets swap in before it paints.
      if (swap && run === epoch) {
        swapStyles(swap);
        swap = undefined;
      }
      scroll();
    },
    fail: () => load(nav, response.url, committed),
  });
  scroll(1);
}

// A page's stylesheets, when its build names them: in dev, vite injects each
// module's styles itself.
function stylesOf(page: number | string | null | undefined) {
  return page == null
    ? undefined
    : styles?.[1][+page]?.map((i) => styles![0][i]);
}

// Links the stylesheets the page lacks in its document's order, inert until
// its content applies; a link only in the content may leave with it.
function linkStyles(hrefs: string[] = []) {
  const linked = new Map<string, Element>();
  for (const link of document.head.querySelectorAll<HTMLLinkElement>(
    "link[rel=stylesheet]",
  )) {
    linked.set(link.href, link);
  }
  const loads: unknown[] = [];
  let next: Element | undefined;
  for (let i = hrefs.length; i--;) {
    let link = linked.get(hrefs[i]);
    if (!link) {
      const sheet = (link = document.createElement("link"));
      sheet.rel = "stylesheet";
      sheet.media = INERT;
      sheet.href = hrefs[i];
      sheets.set(
        sheet,
        new Promise((done) => (sheet.onload = sheet.onerror = done)),
      );
      if (next) next.before(sheet);
      else document.head.append(sheet);
    }
    loads.push(sheets.get(link));
    next = link;
  }
  return loads;
}

// The page's content applied: its stylesheets take effect, and any other a
// page links leaves, wherever marko or the bundler linked it.
function swapStyles(hrefs: string[]) {
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    "link[rel=stylesheet]",
  )) {
    if (hrefs.includes(link.href)) {
      if (link.media === INERT) link.removeAttribute("media");
    } else if (styles![0].includes(link.href)) link.remove();
  }
}

// A document load in the navigation's place; a traversal reloads the entry it
// arrived at rather than adding one.
function load(nav: Navigation, url: string, replace?: boolean) {
  if (nav.pop) location.reload();
  else if (replace) location.replace(url);
  else location.assign(url);
}

// Frames apply as they arrive; a frame that does not apply faithfully, or a
// stream cut before its closing frame, ends the navigation as a document.
async function applyFrames(
  frames: AsyncIterable<string>,
  apply: (frame: string) => Applied | Promise<Applied>,
  run: number,
  on: { commit(): void; applied(): void; fail(): void },
) {
  let ended = false;
  let failed = false;
  let settling: Promise<unknown> | undefined;
  const fail = (why: string) => {
    if (!failed && run === epoch) {
      failed = true;
      warnFallback(why);
      on.fail();
    }
  };
  try {
    for await (const frame of frames) {
      if (run !== epoch) return;
      if (frame === PATCH_END) {
        ended = true;
        continue;
      }
      if (ended) return fail("a frame followed the end");
      on.commit();
      on.commit = () => {};
      const applied = apply(frame);
      if (!applied) return fail("a frame did not apply");
      // A frame a module load defers applies in order on its own; one after it
      // counts as applied once it has.
      if (settling || (applied as Promise<Applied>).then) {
        settling = Promise.all([settling, applied]).then(
          ([, ok]) =>
            ok ? on.applied() : fail("a deferred frame did not apply"),
          () => fail("a deferred frame threw"),
        );
      } else on.applied();
    }
  } catch {
    ended = false;
  }
  if (!ended) fail("the stream ended without its closing frame");
  await settling;
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

/**
 * Scrolls the arriving entry as content applies, as a document load does: a
 * traversal to where it was, else to its fragment's target, else to the top.
 * It retries as frames apply until it lands, the user scrolls or it `end`s.
 */
function scroller({ scroll, hash }: Navigation, run: number) {
  let done: unknown;
  let at: number | undefined;
  return (end?: 1) => {
    if (run !== epoch) return;
    if (end || done || (at !== undefined && at !== scrollY)) done = 1;
    else {
      const [x, y] = scroll || [0, 0];
      const target = !scroll && hash && hashTarget(hash);
      if (target) target.scrollIntoView();
      else scrollTo(x, y);
      at = scrollY;
      done = target || (scroll ? at + 1 > y : !hash);
    }
    holdAnchoring(!done);
  };
}

// Scroll anchoring moves the page as content streams in above where it is,
// which a restore would read as the user scrolling: it waits the restore out.
function holdAnchoring(hold: unknown) {
  const { style } = document.documentElement;
  if (hold && anchoring === undefined) {
    anchoring = style.overflowAnchor;
    style.overflowAnchor = "none";
  } else if (!hold && anchoring !== undefined) {
    style.overflowAnchor = anchoring;
    anchoring = undefined;
  }
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

function setState(state: EntryState) {
  history.replaceState({ ...getState(), ...state }, "");
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

/**
 * The live page's side of a patch, as marko's `patch($global)` gives it: the
 * request headers to send and the frame apply.
 */
type Patch = () => readonly [
  headers: Record<string, string>,
  apply: (frame: string) => boolean | Promise<boolean>,
];

const PATCH_CONTENT_TYPE = "text/marko-patch";

let patch: Patch | undefined;
let pages: RegExp;
let current: string;
let epoch = 0;
let inflight: AbortController | undefined;

/**
 * Turns links and forms to pages into patch requests that update the live
 * document; anything that is not a patch becomes a document load. The app
 * template installs it from its own scope, once.
 */
export function router(page: Patch, pagePaths: RegExp) {
  if (patch) return;
  patch = page;
  pages = pagePaths;
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  current = location.pathname + location.search;
  addEventListener("popstate", () => {
    // A hash-only move stays; a URL no page serves reloads.
    if (current === location.pathname + location.search) return;
    if (isPage(location)) navigate(new Request(location.href), 1);
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
  if (!isLocal(url) || !isPage(url) || (url.hash && isCurrentDocument(url))) {
    return;
  }
  ev.preventDefault();
  navigate(new Request(url));
}

function onSubmit(ev: SubmitEvent) {
  if (ev.defaultPrevented) return;
  const form = ev.target as HTMLFormElement;
  const submitter = ev.submitter;
  const attr = (name: string) =>
    submitter?.getAttribute("form" + name) ?? form.getAttribute(name);
  const method = (attr("method") || "GET").toUpperCase();
  const url = new URL(attr("action") || "", location.href);
  if (
    !isLocal(url) ||
    !isPage(url) ||
    !isSelfTarget(form, submitter) ||
    (method !== "GET" && method !== "POST")
  ) {
    return;
  }
  const data = new FormData(form, submitter || undefined);
  ev.preventDefault();
  if (method === "GET") {
    url.search = "" + new URLSearchParams(data as unknown as string[][]);
    navigate(new Request(url));
  } else {
    const multipart = attr("enctype") === "multipart/form-data";
    navigate(
      new Request(url, {
        method,
        body: multipart
          ? data
          : new URLSearchParams(data as unknown as string[][]),
      }),
    );
  }
}

async function navigate(request: Request, pop?: 1) {
  const run = ++epoch;
  inflight?.abort();
  const { signal } = (inflight = new AbortController());
  // Marko's own account of what the live page holds rides its headers.
  const [headers, apply] = patch!();
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
  await applyFrames(
    readFrames(response.body),
    apply,
    run,
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

// Frames apply as they arrive; a frame that does not apply faithfully (or
// whose page code fails to load) ends the navigation as a document.
async function applyFrames(
  frames: AsyncIterable<string>,
  apply: (frame: string) => boolean | Promise<boolean>,
  run: number,
  commit: () => void,
  fail: () => void,
) {
  const settle = (applied: boolean) => {
    if (!applied && run === epoch) fail();
  };
  try {
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

function isSelfTarget(el: Element, submitter?: HTMLElement | null) {
  const target =
    submitter?.getAttribute("formtarget") ?? el.getAttribute("target");
  return !target || target === "_self";
}

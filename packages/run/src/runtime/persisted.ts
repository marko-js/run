// Client router for persisted (single-page server-first) navigations.
//
// Generated route wrapper templates call `register` with the app's route
// table (see `renderRoutesClient` in ../vite/codegen) and their own route's
// path pattern. From then on, clicks on links matching any table pattern
// are intercepted: the target is fetched with update content negotiation
// (`accept: text/marko-patch` plus the matched pattern and build identity,
// which the generated router verifies before rendering in update mode);
// the target route's generated `?update` entry — and, for cross-route
// navigations, its template module, whose import registers the route's
// renderers, signals, and merges — load in parallel; and the streamed
// patch applies to the live page through the entry's compiled merge
// functions. Matched scopes value-update; a route's diverging content
// swaps in as a fresh branch at the layout's already-dynamic content hop.
// Client state above the divergence point survives; any protocol failure
// falls back to a full navigation.
export interface UpdateEntry {
  /** The route template's compiled merge function. */
  default: (patch: unknown, live: unknown) => void;
  /**
   * Re-exported by the generated entry so this module never imports the
   * marko runtime itself — a second runtime instance would have its own
   * resume registry and silently pair nothing. `createUpdate` is the
   * per-navigation streaming applier: one call per response frame against a
   * shared patch context.
   */
  createUpdate: (
    merge: (patch: unknown, live: unknown) => void,
    liveRoot?: unknown,
  ) => (fills: unknown[]) => void;
}

/** A generated route-table entry: [pattern, loadTemplate, loadUpdate]. */
export type RouteEntry = [
  pattern: string,
  loadTemplate: () => Promise<unknown>,
  loadUpdate: () => Promise<UpdateEntry>,
];

interface MatchableRoute {
  pattern: string;
  test: RegExp;
  loadTemplate: () => Promise<unknown>;
  loadUpdate: () => Promise<UpdateEntry>;
}

const patchContentType = "text/marko-patch";
let routes: MatchableRoute[] | undefined;
let currentPattern: string;
let buildHash: string;
// The last URL an update was applied for (or the initial document URL) —
// popstate events that don't change it (hash-only movement) stay native.
let appliedUrl: string;
let controller: AbortController | undefined;

export function register(
  table: RouteEntry[],
  // The pattern of the route this page rendered through.
  pattern: string,
  // The build this page (and its loaded code) was served with, serialized
  // into `$global` by the generated router; the server only honors update
  // fetches from its own build.
  hash: string,
) {
  if (!routes) {
    appliedUrl = location.pathname + location.search;
    addEventListener("click", onClick);
    addEventListener("submit", onSubmit);
    addEventListener("popstate", onPopstate);
  }
  routes = table.map(([p, loadTemplate, loadUpdate]) => ({
    pattern: p,
    test: patternToRegExp(p),
    loadTemplate,
    loadUpdate,
  }));
  currentPattern = pattern;
  buildHash = hash;
}

// First table match wins; the client's linear order can disagree with the
// server's ranked trie (e.g. a static segment route listed after a dynamic
// one) — the server's `x-marko-route` verification 409s those into a full
// navigation.
function matchRoute(pathname: string) {
  for (const route of routes!) {
    if (route.test.test(pathname)) return route;
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

  const link = (ev.target as Element).closest?.("a[href]");
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.origin !== location.origin ||
    (link.target && link.target !== "_self") ||
    link.hasAttribute("download") ||
    link.getAttribute("rel")?.includes("external")
  ) {
    return;
  }

  // Same-document fragment movement stays native.
  if (
    link.hash &&
    link.pathname === location.pathname &&
    link.search === location.search
  ) {
    return;
  }

  const target = matchRoute(decode(link.pathname));
  if (!target) return;

  ev.preventDefault();
  navigate(link.href, true, target);
}

// Same-origin form submissions route through the update pipeline: a GET
// form is a link with parameters (the body becomes the query), and a POST
// is the PRG pattern -- the mutation runs, the redirect's followed GET
// negotiates the update (the server verifies `x-marko-route` against the
// final URL's route, so cross-route redirects 409 into a full
// navigation). Forms the app already handles (`preventDefault` in an
// earlier listener) are untouched.
function onSubmit(ev: SubmitEvent) {
  const form = ev.target as HTMLFormElement;
  const submitter = ev.submitter;
  const method = (
    submitter?.getAttribute("formmethod") || getFormAttr(form, "method")
  )?.toLowerCase();
  if (
    ev.defaultPrevented ||
    resubmitting ||
    (method !== "get" && method !== "post")
  ) {
    return;
  }

  const url = new URL(
    submitter?.getAttribute("formaction") ??
      getFormAttr(form, "action") ??
      location.href,
    location.href,
  );
  const formTarget =
    submitter?.getAttribute("formtarget") || getFormAttr(form, "target");
  if (
    url.origin !== location.origin ||
    (formTarget && formTarget !== "_self")
  ) {
    return;
  }

  const target = matchRoute(decode(url.pathname));
  if (!target) return;

  const data = new FormData(form, submitter);
  if (method === "get") {
    // Mirrors native GET submission: the body becomes the query (files
    // submit their name, as native does; the submitter's name/value is
    // included).
    const params = new URLSearchParams();
    for (const [name, value] of data) {
      params.append(name, typeof value === "string" ? value : value.name);
    }
    url.search = params.toString();
    ev.preventDefault();
    navigate(url.href, true, target);
  } else {
    const enctype = (
      submitter?.getAttribute("formenctype") || getFormAttr(form, "enctype")
    )?.toLowerCase();
    if (enctype === "text/plain") return; // rare; stays native
    let body: FormData | URLSearchParams = data;
    if (enctype !== "multipart/form-data") {
      // fetch encodes URLSearchParams as application/x-www-form-urlencoded,
      // the native default.
      body = new URLSearchParams();
      for (const [name, value] of data) {
        body.append(name, typeof value === "string" ? value : value.name);
      }
    }
    ev.preventDefault();
    navigate(url.href, true, target, [body, form, submitter]);
  }
}

// Set while the fallback ladder hands a failed pre-response mutation back
// to the browser (`requestSubmit` re-fires the submit event).
let resubmitting: undefined | 0 | 1;

// Reads a form attribute robustly: a control named eg `action` shadows the
// `form.action` property (DOM clobbering), and missing attributes must fall
// back to the native default.
function getFormAttr(form: HTMLFormElement, name: string) {
  return form.getAttribute(name) || (name === "method" ? "get" : undefined);
}

function onPopstate() {
  const url = location.pathname + location.search;
  if (url === appliedUrl) return;
  const target = matchRoute(decode(location.pathname));
  if (target) {
    navigate(location.href, false, target);
  } else {
    location.reload();
  }
}

async function navigate(
  href: string,
  push: boolean,
  target: MatchableRoute,
  // A mutation (POST form submission): [body, form, submitter].
  mutation?: [
    body: FormData | URLSearchParams,
    form: HTMLFormElement,
    submitter: HTMLElement | null,
  ],
) {
  // Later navigations abort superseded fetches -- except mutations, which
  // the server may already have applied; those run to completion and only
  // their *application* is superseded (the per-frame signal check).
  controller?.abort();
  const { signal } = (controller = new AbortController());
  let res: Response | undefined;

  try {
    const [fetched, entry] = await Promise.all([
      fetch(href, {
        method: mutation && "POST",
        body: mutation?.[0],
        headers: {
          accept: patchContentType,
          "x-marko-route": target.pattern,
          // The route this page is currently showing -- a differing target
          // is a cross-route navigation, whose update render also seeds
          // state for the subtree the client will create fresh.
          "x-marko-from": currentPattern,
          "x-marko-build": String(buildHash),
        },
        signal: mutation ? undefined : signal,
      }),
      target.loadUpdate(),
      // Cross-route: the target's template module registers the renderers,
      // signals, and merges its patch will resolve from the registry.
      target.pattern === currentPattern ? undefined : target.loadTemplate(),
    ]);
    res = fetched;
    if (signal.aborted) return;

    // Content-type, not status, decides: non-2xx patch responses (eg a
    // validation error re-rendering the page) still apply -- keeping
    // focus and scroll is exactly when it matters most. A redirect was
    // followed by now (PRG); its route was verified against the final URL
    // server-side, so a cross-route redirect lands here as a non-patch
    // 409 and falls back below.
    if (!res.headers.get("content-type")?.includes(patchContentType)) {
      // Production keeps only the status (it distinguishes protocol 409s
      // from real failures in the fallback warn); dev gets the description.
      throw new Error(
        process.env.NODE_ENV !== "production"
          ? `unexpected update response (${res.status})`
          : String(res.status),
      );
    }

    // Update responses are a newline-delimited stream of serializer frames:
    // each line is a bare JS array of resume fills (the serializer escapes
    // newlines in values). Frames apply as they arrive against a shared
    // per-navigation patch context, so the synchronous page content settles
    // immediately while slow async boundaries (`<await>` bodies) land in
    // later frames — the same progressive behavior as a streamed document.
    const applyFrame = entry.createUpdate(entry.default);
    const parseFrame = getParseFrame();
    let applied = false;
    const applyLine = (line: string) => {
      if (!line) return;
      const fills: unknown[] = [];
      // Functions are resume fills; strings are effect entries the applier
      // executes only for scopes it freshly created during the apply;
      // arrays are fragment / boundary-body entries (a cross-route
      // navigation's diverging subtree, delivered as resumable HTML).
      for (const item of parseFrame(line) as unknown[]) {
        if (
          typeof item === "function" ||
          typeof item === "string" ||
          Array.isArray(item)
        ) {
          fills.push(item);
        }
      }
      if (!fills.length) return;
      applyFrame(fills);
      if (!applied) {
        // The navigation commits with the first applied frame (when the
        // page's synchronous content lands), mirroring a streamed MPA
        // render starting to paint.
        applied = true;
        currentPattern = target.pattern;
        const url = new URL(res!.url || href);
        // An in-place refresh (a PRG redirect landing back on the same
        // URL) adds no history entry.
        const samePage = url.pathname + url.search === appliedUrl;
        appliedUrl = url.pathname + url.search;
        if (push && !samePage) {
          history.pushState(null, "", url.href);
          scrollTo(0, 0);
        }
      }
    };

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) return;
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
        process.env.NODE_ENV !== "production"
          ? "update response carried no fills"
          : undefined,
      );
    }
    dispatchEvent(new CustomEvent("marko-run:navigate"));
  } catch (err) {
    if (signal.aborted) return; // Superseded by a newer navigation.
    // Fallback ladder: any protocol failure becomes a full navigation. A
    // mutation must never replay: with a response in hand the mutation
    // happened -- follow its final URL with a plain GET; without one it
    // may or may not have -- hand the submission back to the browser
    // (standard POST navigation semantics, resubmission warnings
    // included).
    if (mutation) {
      if (res) {
        location.assign(res.url || href);
      } else {
        resubmitting = 1;
        try {
          mutation[1].requestSubmit(mutation[2]);
        } finally {
          resubmitting = 0 as never;
        }
      }
    } else if (push) {
      location.assign(href);
    } else {
      location.reload();
    }
    if (typeof console !== "undefined") {
      console.warn("@marko/run: persisted navigation fell back", err);
    }
  }
}

// Mirrors the generated router's matching for a single route pattern:
// `$name` matches one segment, `$$name` the (possibly empty) rest.
function patternToRegExp(pattern: string) {
  let source = "^";
  for (const segment of pattern.split("/")) {
    if (!segment) continue;
    if (segment.startsWith("$$")) {
      return new RegExp(source + "(?:/.*)?$");
    }
    source +=
      "/" +
      (segment.charAt(0) === "$"
        ? "[^/]+"
        : segment.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&"));
  }
  return new RegExp(source + "/?$");
}

function decode(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

// Frames are JS expressions (resume fills include closures) -- the same
// content the document's resume ran as inline scripts. `new Function` is
// the fast path; a CSP without 'unsafe-eval' throws on the one-time probe,
// and frames execute as injected script elements instead: trusted
// automatically under 'strict-dynamic', or via the page's own nonce (the
// IDL property stays readable after browsers hide the attribute value) --
// the exact trust model of the resume scripts already run. If injection is
// blocked too, the frame comes back undefined, the first apply throws, and
// the navigation falls back to a full document load.
let parseFrameImpl: undefined | ((line: string) => unknown[]);
function getParseFrame() {
  if (!parseFrameImpl) {
    try {
      new Function("");
      parseFrameImpl = (line) =>
        new Function(`return (${line})`)() as unknown[];
    } catch {
      const nonce =
        document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
      parseFrameImpl = (line) => {
        const script = document.createElement("script");
        if (nonce) script.nonce = nonce;
        script.textContent = `self.__marko_run_frame__=(${line})`;
        document.head.appendChild(script).remove();
        const frame = (self as any).__marko_run_frame__ as unknown[];
        delete (self as any).__marko_run_frame__;
        return frame;
      };
    }
  }
  return parseFrameImpl;
}

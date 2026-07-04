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

async function navigate(href: string, push: boolean, target: MatchableRoute) {
  controller?.abort();
  const { signal } = (controller = new AbortController());

  try {
    const [res, entry] = await Promise.all([
      fetch(href, {
        headers: {
          accept: patchContentType,
          "x-marko-route": target.pattern,
          "x-marko-build": String(buildHash),
        },
        signal,
      }),
      target.loadUpdate(),
      // Cross-route: the target's template module registers the renderers,
      // signals, and merges its patch will resolve from the registry.
      target.pattern === currentPattern ? undefined : target.loadTemplate(),
    ]);

    if (
      !res.ok ||
      !res.headers.get("content-type")?.includes(patchContentType)
    ) {
      throw new Error(`unexpected update response (${res.status})`);
    }

    // Update responses are a newline-delimited stream of serializer frames:
    // each line is a bare JS array of resume fills (the serializer escapes
    // newlines in values). Frames apply as they arrive against a shared
    // per-navigation patch context, so the synchronous page content settles
    // immediately while slow async boundaries (`<await>` bodies) land in
    // later frames — the same progressive behavior as a streamed document.
    const applyFrame = entry.createUpdate(entry.default);
    let applied = false;
    const applyLine = (line: string) => {
      if (!line) return;
      const fills: unknown[] = [];
      for (const item of new Function(`return (${line})`)() as unknown[]) {
        if (typeof item === "function") fills.push(item);
      }
      if (!fills.length) return;
      applyFrame(fills);
      if (!applied) {
        // The navigation commits with the first applied frame (when the
        // page's synchronous content lands), mirroring a streamed MPA
        // render starting to paint.
        applied = true;
        currentPattern = target.pattern;
        const url = new URL(res.url || href);
        appliedUrl = url.pathname + url.search;
        if (push) {
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
      throw new Error("update response carried no fills");
    }
  } catch (err) {
    if (signal.aborted) return; // Superseded by a newer navigation.
    // Fallback ladder: any protocol failure becomes a full navigation.
    if (push) {
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

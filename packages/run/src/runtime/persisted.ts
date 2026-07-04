// Client router for persisted (single-page server-first) navigations.
//
// Generated route wrapper templates call `register` with their route's path
// pattern and an importer for their generated `?update` entry (see
// `renderRouteTemplate` in ../vite/codegen). From then on, clicks on links
// that resolve to the same route are intercepted: the target is fetched with
// update content negotiation (`accept: text/marko-patch` plus the route
// pattern, which the generated router verifies before rendering in update
// mode), the entry chunk is lazy-loaded in parallel, and the streamed patch
// is applied to the live page through the entry's compiled merge functions —
// no reload, client state intact. Any protocol failure falls back to a full
// navigation.
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

interface RegisteredRoute {
  pattern: string;
  buildHash: string;
  test: RegExp;
  getUpdate: () => Promise<UpdateEntry>;
}

const patchContentType = "text/marko-patch";
let current: RegisteredRoute | undefined;
// The last URL an update was applied for (or the initial document URL) —
// popstate events that don't change it (hash-only movement) stay native.
let appliedUrl: string;
let controller: AbortController | undefined;

export function register(
  pattern: string,
  // The build this page (and its loaded code) was served with, serialized
  // into `$global` by the generated router; the server only honors update
  // fetches from its own build.
  buildHash: string,
  getUpdate: () => Promise<UpdateEntry>,
) {
  if (!current) {
    appliedUrl = location.pathname + location.search;
    addEventListener("click", onClick);
    addEventListener("popstate", onPopstate);
  }
  current = { pattern, buildHash, test: patternToRegExp(pattern), getUpdate };
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

  if (!current!.test.test(decode(link.pathname))) return;

  ev.preventDefault();
  navigate(link.href, true);
}

function onPopstate() {
  const url = location.pathname + location.search;
  if (url !== appliedUrl) navigate(location.href, false);
}

async function navigate(href: string, push: boolean) {
  const { pattern, buildHash, getUpdate } = current!;
  controller?.abort();
  const { signal } = (controller = new AbortController());

  try {
    const [res, entry] = await Promise.all([
      fetch(href, {
        headers: {
          accept: patchContentType,
          "x-marko-route": pattern,
          "x-marko-build": String(buildHash),
        },
        signal,
      }),
      getUpdate(),
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

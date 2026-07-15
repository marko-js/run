import assert from "assert";
import { JSDOM } from "jsdom";

import type {
  Mutation,
  NavigationState,
  RouteEntry,
  UpdateEntry,
} from "../runtime/persisted-navigation";

// The client navigation module runs against browser globals; a jsdom window
// supplies them for the whole file (assigned before the modules are
// imported). `location.assign`/`location.replace` would be jsdom "not
// implemented" navigations, so they are replaced with recording stubs.
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3000/list?page=1",
});
const window = dom.window;
const navigations: string[] = [];
// jsdom's location methods are non-configurable, so the global the modules
// see is a recording stub that delegates reads to the real (history-synced)
// location.
(globalThis as any).location = {
  get href() {
    return window.location.href;
  },
  get origin() {
    return window.location.origin;
  },
  get pathname() {
    return window.location.pathname;
  },
  get search() {
    return window.location.search;
  },
  get hash() {
    return window.location.hash;
  },
  assign: (href: string) => navigations.push(`assign:${href}`),
  replace: (href: string) => navigations.push(`replace:${href}`),
  reload: () => navigations.push("reload:"),
};
for (const key of [
  "document",
  "history",
  "CustomEvent",
  "MouseEvent",
  "PopStateEvent",
  "FormData",
  "HTMLAnchorElement",
  "HTMLFormElement",
] as const) {
  (globalThis as any)[key] = (window as any)[key];
}
(globalThis as any).window = window;
(globalThis as any).addEventListener = window.addEventListener.bind(window);
(globalThis as any).dispatchEvent = window.dispatchEvent.bind(window);
let scrolls: unknown[][] = [];
(globalThis as any).scrollTo = (...args: unknown[]) => scrolls.push(args);

type FetchCall = { href: string; init: RequestInit };
let fetchCalls: FetchCall[] = [];
let fetchImpl: (href: string, init: RequestInit) => Promise<Response>;
(globalThis as any).fetch = (href: string, init: RequestInit) => {
  fetchCalls.push({ href, init });
  return fetchImpl(href, init);
};

const patchHeaders = { "content-type": "text/javascript;charset=UTF-8" };
const patchResponse = (
  frames: string[],
  url = "",
  headers: Record<string, string> = patchHeaders,
) => {
  const response = new Response(frames.join("\n"), { headers });
  if (url) Object.defineProperty(response, "url", { value: url });
  return response;
};

/** An entry whose createPatch treats a frame as `apply:<0|1>` per line. */
const makeEntry = (applied: string[], have?: string): UpdateEntry => ({
  createPatch: () => (source: string) => {
    applied.push(source);
    return source.startsWith("fill");
  },
  ...(have !== undefined ? { have: () => have } : null),
});

const makeState = (overrides?: Partial<NavigationState>): NavigationState => ({
  appliedUrl: "/list?page=1",
  buildHash: "build-1",
  currentId: 1,
  ...overrides,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("persisted client navigate()", () => {
  let navigate: typeof import("../runtime/persisted-navigation").navigate;
  before(async () => {
    ({ navigate } = await import("../runtime/persisted-navigation"));
  });
  beforeEach(() => {
    fetchCalls = [];
    navigations.length = 0;
    scrolls = [];
    window.history.replaceState(null, "", "/list?page=1");
  });

  function run(
    state: NavigationState,
    href: string,
    entry: UpdateEntry,
    { push = true, targetId = 2, mutation, fallbacks = [] as unknown[][] } = {},
  ) {
    const target: RouteEntry = [
      targetId,
      () => Promise.resolve(0),
      () => Promise.resolve(entry),
    ];
    return navigate(
      state,
      href,
      push,
      target,
      mutation as Mutation | undefined,
      (...args) => void fallbacks.push(args),
    );
  }

  it("applies streamed frames and advances history once", async () => {
    const applied: string[] = [];
    const events: string[] = [];
    window.addEventListener("marko-run:navigate", () =>
      events.push("navigate"),
    );
    fetchImpl = async (href) => patchResponse(["fill-1", "fill-2"], href);
    const state = makeState();
    await run(state, "http://localhost:3000/item/2", makeEntry(applied));

    assert.deepEqual(applied, ["fill-1", "fill-2"]);
    assert.equal(state.currentId, 2);
    assert.equal(state.appliedUrl, "/item/2");
    assert.equal(window.location.pathname, "/item/2");
    assert.deepEqual(scrolls, [[0, 0]]);
    assert.deepEqual(events, ["navigate"]);
    assert.deepEqual(navigations, []);
    // Sends negotiation headers.
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    assert.equal(headers.accept, "text/marko-patch");
    assert.equal(headers["x-marko-route"], "2");
    assert.equal(headers["x-marko-from"], "1");
    assert.equal(headers["x-marko-build"], "build-1");
  });

  it("sends the possession echo when the entry provides one", async () => {
    fetchImpl = async () => patchResponse(["fill"]);
    await run(makeState(), "http://localhost:3000/item/2", {
      ...makeEntry([]),
      have: () => '{"!site":"1"}',
    });
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    assert.equal(headers["x-marko-have"], '{"!site":"1"}');
  });

  it("keeps the original fragment and scrolls to its anchor", async () => {
    const anchor = window.document.createElement("div");
    anchor.id = "section";
    let scrolledIntoView = 0;
    (anchor as any).scrollIntoView = () => scrolledIntoView++;
    window.document.body.append(anchor);
    fetchImpl = async () =>
      // fetch drops fragments from response.url.
      patchResponse(["fill"], "http://localhost:3000/item/2");
    await run(
      makeState(),
      "http://localhost:3000/item/2#section",
      makeEntry([]),
    );
    assert.equal(window.location.hash, "#section");
    assert.equal(scrolledIntoView, 1);
    assert.deepEqual(scrolls, []);
    anchor.remove();
  });

  it("does not push history when the applied URL is unchanged", async () => {
    fetchImpl = async () =>
      patchResponse(["fill"], "http://localhost:3000/list?page=1");
    const before = window.history.length;
    await run(makeState(), "http://localhost:3000/list?page=1", makeEntry([]));
    assert.equal(window.history.length, before);
  });

  it("falls back on a non-patch response without applying", async () => {
    const applied: string[] = [];
    const fallbacks: unknown[][] = [];
    fetchImpl = async () =>
      new Response("<!doctype html>", {
        headers: { "content-type": "text/html" },
      });
    const state = makeState();
    await run(state, "http://localhost:3000/item/2", makeEntry(applied), {
      fallbacks,
    });
    assert.deepEqual(applied, []);
    assert.equal(state.currentId, 1);
    assert.equal(fallbacks.length, 1);
    // href and the response are forwarded so a mutation fallback can follow
    // the response's final URL.
    assert.equal(fallbacks[0][1], "http://localhost:3000/item/2");
    assert.ok(fallbacks[0][4] instanceof Response);
  });

  it("falls back when no frame carries fills", async () => {
    const fallbacks: unknown[][] = [];
    fetchImpl = async () => patchResponse(["skip-a", "skip-b"]);
    await run(makeState(), "http://localhost:3000/item/2", makeEntry([]), {
      fallbacks,
    });
    assert.equal(fallbacks.length, 1);
  });

  it("replaces (not assigns) after a mid-stream failure once applied", async () => {
    const fallbacks: unknown[][] = [];
    fetchImpl = async (href) => {
      // Erroring in start() would discard the queued chunk; phase it through
      // pull() so the first frame is delivered before the failure.
      let pulls = 0;
      const response = new Response(
        new ReadableStream<Uint8Array>({
          pull(ctrl) {
            if (pulls++) ctrl.error(new Error("connection lost"));
            else ctrl.enqueue(new TextEncoder().encode("fill-1\n"));
          },
        }),
        { headers: patchHeaders },
      );
      Object.defineProperty(response, "url", { value: href });
      return response;
    };
    const state = makeState();
    await run(state, "http://localhost:3000/item/2", makeEntry([]), {
      fallbacks,
    });
    // History already advanced for this navigation; the fallback document
    // must replace it rather than stacking a duplicate entry.
    assert.equal(window.location.pathname, "/item/2");
    assert.deepEqual(navigations, ["replace:http://localhost:3000/item/2"]);
    assert.deepEqual(fallbacks, []);
  });

  it("a superseding navigation aborts the prior one silently", async () => {
    const applied: string[] = [];
    const fallbacks: unknown[][] = [];
    let firstController!: ReadableStreamDefaultController<Uint8Array>;
    let cancelled = 0;
    fetchImpl = async () => {
      const response = new Response(
        new ReadableStream<Uint8Array>({
          start(ctrl) {
            firstController = ctrl;
            ctrl.enqueue(new TextEncoder().encode("fill-first\n"));
          },
          cancel() {
            cancelled++;
          },
        }),
        { headers: patchHeaders },
      );
      Object.defineProperty(response, "url", {
        value: "http://localhost:3000/item/2",
      });
      return response;
    };
    const state = makeState();
    const first = run(
      state,
      "http://localhost:3000/item/2",
      makeEntry(applied),
      {
        fallbacks,
      },
    );
    await flush();
    assert.deepEqual(applied, ["fill-first"]);

    // Second navigation supersedes; give it its own immediate response.
    fetchImpl = async () =>
      patchResponse(["fill-second"], "http://localhost:3000/item/3");
    const second = run(
      state,
      "http://localhost:3000/item/3",
      makeEntry(applied),
      { targetId: 3, fallbacks },
    );
    await flush();
    // Unblock the first stream after it was superseded (left open so the
    // aborted reader's cancel() reaches the underlying source).
    firstController.enqueue(new TextEncoder().encode("fill-late\n"));
    await Promise.all([first, second]);

    assert.deepEqual(applied, ["fill-first", "fill-second"]);
    assert.equal(state.currentId, 3);
    assert.equal(state.appliedUrl, "/item/3");
    assert.deepEqual(fallbacks, []);
    assert.equal(cancelled, 1);
  });

  it("sends mutations as POST with the form body and no abort signal", async () => {
    fetchImpl = async () =>
      patchResponse(["fill"], "http://localhost:3000/list?page=1");
    const body = new window.URLSearchParams("a=1");
    const mutation = [body, {}, null] as unknown as Mutation;
    await run(makeState(), "http://localhost:3000/list?page=1", makeEntry([]), {
      targetId: 1,
      mutation,
    });
    assert.equal(fetchCalls[0].init.method, "POST");
    assert.equal(fetchCalls[0].init.body, body);
    assert.equal(fetchCalls[0].init.signal, undefined);
  });
});

describe("persisted client interception", () => {
  let routeId: number | null = 2;
  const entryApplied: string[] = [];
  before(async () => {
    fetchImpl = async () => patchResponse(["fill"]);
    const { register } = await import("../runtime/persisted");
    register(
      () =>
        Promise.resolve((pathname: string) =>
          routeId === null
            ? null
            : ([
                routeId,
                () => Promise.resolve(0),
                () => Promise.resolve(makeEntry(entryApplied)),
              ] as RouteEntry),
        ),
      1,
      "build-1",
    );
  });
  beforeEach(() => {
    fetchCalls = [];
    navigations.length = 0;
    window.history.replaceState(null, "", "/list?page=1");
    window.document.body.innerHTML = "";
  });

  function click(a: HTMLAnchorElement, init?: MouseEventInit) {
    window.document.body.append(a);
    const ev = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    a.dispatchEvent(ev);
    return ev.defaultPrevented;
  }

  function link(href: string, mutate?: (a: HTMLAnchorElement) => void) {
    const a = window.document.createElement("a");
    a.href = href;
    mutate?.(a);
    return a;
  }

  it("leaves same-document fragment movement native", async () => {
    // Declared first: jsdom performs the (unprevented) fragment navigation,
    // which fires popstate; the module ignores it only while `appliedUrl`
    // still matches this page, i.e. before any test navigates away.
    assert.equal(click(link("/list?page=1#details")), false);
    await flush();
    assert.equal(fetchCalls.length, 0, JSON.stringify(fetchCalls));
  });

  it("intercepts an ordinary same-origin link", async () => {
    assert.equal(click(link("/item/2")), true);
    await flush();
    assert.equal(fetchCalls.length, 1);
    assert.equal(
      (fetchCalls[0].init.headers as Record<string, string>).accept,
      "text/marko-patch",
    );
  });

  it("leaves modified clicks, targets, downloads, and externals native", async () => {
    assert.equal(click(link("/item/2"), { ctrlKey: true }), false);
    assert.equal(click(link("/item/2"), { metaKey: true }), false);
    assert.equal(click(link("/item/2"), { shiftKey: true }), false);
    assert.equal(click(link("/item/2"), { button: 1 }), false);
    assert.equal(click(link("/item/2", (a) => (a.target = "_blank"))), false);
    assert.equal(
      click(link("/item/2", (a) => a.setAttribute("download", ""))),
      false,
    );
    assert.equal(click(link("/item/2", (a) => (a.rel = "external"))), false);
    assert.equal(click(link("https://other.example/item/2")), false);
    await flush();
    assert.equal(fetchCalls.length, 0);
  });

  it("falls back natively when the target does not match a route", async () => {
    routeId = null;
    try {
      assert.equal(click(link("/outside")), true);
      await flush();
      assert.equal(fetchCalls.length, 0);
      assert.deepEqual(navigations, ["assign:http://localhost:3000/outside"]);
    } finally {
      routeId = 2;
    }
  });

  function submit(
    form: HTMLFormElement,
    submitter?: HTMLElement | null,
  ): boolean {
    window.document.body.append(form);
    let prevented = false;
    const record = (ev: Event) => {
      prevented = ev.defaultPrevented;
      // Stop jsdom's own (unimplemented) form navigation.
      ev.preventDefault();
    };
    window.addEventListener("submit", record);
    try {
      form.requestSubmit(submitter as HTMLElement | undefined);
    } finally {
      window.removeEventListener("submit", record);
    }
    return prevented;
  }

  function form(html: string) {
    const template = window.document.createElement("template");
    template.innerHTML = html;
    return template.content.firstElementChild as HTMLFormElement;
  }

  it("serializes a GET form into the target URL", async () => {
    const f = form(
      `<form action="/search"><input name="q" value="socks"><button></button></form>`,
    );
    assert.equal(submit(f, f.querySelector("button")), true);
    await flush();
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].href, "http://localhost:3000/search?q=socks");
    assert.equal(fetchCalls[0].init.method, undefined);
  });

  it("posts a urlencoded form body through the update path", async () => {
    const f = form(
      `<form action="/list" method="post"><input name="a" value="1"><button></button></form>`,
    );
    assert.equal(submit(f, f.querySelector("button")), true);
    await flush();
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].init.method, "POST");
    assert.ok(fetchCalls[0].init.body instanceof URLSearchParams);
    assert.equal(String(fetchCalls[0].init.body), "a=1");
  });

  it("keeps multipart bodies as FormData", async () => {
    const f = form(
      `<form action="/list" method="post" enctype="multipart/form-data"><input name="a" value="1"><button></button></form>`,
    );
    assert.equal(submit(f, f.querySelector("button")), true);
    await flush();
    assert.ok(fetchCalls[0].init.body instanceof window.FormData);
  });

  it("honors submitter formmethod/formaction overrides", async () => {
    const f = form(
      `<form action="/list"><input name="a" value="1"><button formmethod="post" formaction="/other"></button></form>`,
    );
    assert.equal(submit(f, f.querySelector("button")), true);
    await flush();
    assert.equal(fetchCalls[0].href, "http://localhost:3000/other");
    assert.equal(fetchCalls[0].init.method, "POST");
  });

  it("leaves text/plain, foreign-target, and cross-origin forms native", async () => {
    assert.equal(
      submit(
        form(
          `<form action="/list" method="post" enctype="text/plain"><button></button></form>`,
        ),
      ),
      false,
    );
    assert.equal(
      submit(
        form(`<form action="/list" target="_blank"><button></button></form>`),
      ),
      false,
    );
    assert.equal(
      submit(
        form(`<form action="https://other.example/x"><button></button></form>`),
      ),
      false,
    );
    await flush();
    assert.equal(fetchCalls.length, 0);
  });

  it("navigates on popstate to a different URL and ignores the applied one", async () => {
    fetchImpl = async () =>
      patchResponse(["fill"], "http://localhost:3000/item/9");
    // The registered state's appliedUrl is stale relative to this test's
    // URL, so re-sync it through a real interception first.
    assert.equal(click(link("/item/9")), true);
    await flush();
    fetchCalls = [];

    // Same URL as applied: ignored.
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await flush();
    assert.equal(fetchCalls.length, 0);

    // Different URL: intercepted.
    window.history.replaceState(null, "", "/list?page=2");
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await flush();
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].href, "http://localhost:3000/list?page=2");
  });
});

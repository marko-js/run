import assert from "assert";
import { JSDOM } from "jsdom";

import type {
  Mutation,
  NavigationState,
  PersistedEntry,
  RouteEntry,
} from "../runtime/persisted-navigation";
import { digestWidth } from "../runtime/persisted-protocol";
import { CLAIM_A, CLAIM_A2, CLAIM_B, CLAIM_C, CLAIM_Z } from "./utils/claims";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3000/list?page=1",
});
const window = dom.window;
const navigations: string[] = [];
let scrolls: unknown[][] = [];
let scrollPos = [0, 0];

type FetchCall = { href: string; init: RequestInit };
let fetchCalls: FetchCall[] = [];
let fetchImpl: (href: string, init: RequestInit) => Promise<Response>;

// The jsdom-backed globals the client navigation modules read (always at call
// time, never at module load). The `location` stub records navigation methods
// while delegating reads to jsdom's synced location.
const browserGlobals = {
  location: {
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
  },
  document: window.document,
  history: window.history,
  CustomEvent: window.CustomEvent,
  MouseEvent: window.MouseEvent,
  PopStateEvent: window.PopStateEvent,
  FormData: window.FormData,
  HTMLAnchorElement: window.HTMLAnchorElement,
  HTMLFormElement: window.HTMLFormElement,
  window,
  addEventListener: window.addEventListener.bind(window),
  dispatchEvent: window.dispatchEvent.bind(window),
  scrollTo: (...args: unknown[]) => {
    scrolls.push(args);
    scrollPos = args as number[];
  },
  get scrollX() {
    return scrollPos[0];
  },
  get scrollY() {
    return scrollPos[1];
  },
  fetch: (href: string, init: RequestInit) => {
    fetchCalls.push({ href, init });
    return fetchImpl(href, init);
  },
};

/**
 * Installs the jsdom-backed globals for one suite and restores the real node
 * globals afterward; installing them at module load would poison the fixture
 * e2e suites, which drive real servers through `fetch`/`FormData` in the same
 * process. With `isolateListeners`, window listeners registered while the
 * suite runs (fresh `persisted` instances imported with a query suffix) are
 * detached again so later suites' events reach only their own instance.
 */
function useBrowserGlobals(isolateListeners = false) {
  const saved: [string, PropertyDescriptor | undefined][] = [];
  const added: [string, EventListenerOrEventListenerObject][] = [];
  before(() => {
    // Descriptor installation keeps live accessors (scrollX/scrollY) live.
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(browserGlobals),
    )) {
      saved.push([key, Object.getOwnPropertyDescriptor(globalThis, key)]);
      Object.defineProperty(globalThis, key, descriptor);
    }
    if (isolateListeners) {
      (globalThis as any).addEventListener = (
        type: string,
        fn: EventListenerOrEventListenerObject,
      ) => {
        added.push([type, fn]);
        browserGlobals.addEventListener(type as never, fn as never);
      };
    }
  });
  after(() => {
    for (const [type, fn] of added) window.removeEventListener(type, fn);
    added.length = 0;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
    saved.length = 0;
  });
}

const patchHeaders = {
  "content-type": "text/javascript;charset=UTF-8",
  "x-marko-build": "build-1",
};
const marker = "//E1:";
/** A body exactly as given: no completion marker is supplied, which is
 * how a truncated (or marker-rewritten) stream is written here. */
const truncatedPatch = (
  frames: string[],
  url = "",
  headers: Record<string, string> = patchHeaders,
) => {
  const response = new Response(frames.join("\n"), { headers });
  if (url) Object.defineProperty(response, "url", { value: url });
  return response;
};
/** A COMPLETE patch response. The server writes the `//E1:` footer last
 * on every successful patch, so a fixture that carries no feedback line
 * of its own gets the bare marker — a body without one is truncated by
 * definition and the client refuses it. */
const patchResponse = (
  frames: string[],
  url = "",
  headers: Record<string, string> = patchHeaders,
) =>
  truncatedPatch(
    frames.some((frame) => frame.startsWith(marker))
      ? frames
      : [...frames, marker],
    url,
    headers,
  );

/** A patch response whose frames are enqueued manually mid-test. */
const streamedPatch = (url: string) => {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = 0;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        ctrl = c;
      },
      cancel() {
        cancelled++;
      },
    }),
    { headers: patchHeaders },
  );
  Object.defineProperty(response, "url", { value: url });
  return {
    response,
    enqueue: (frame: string) =>
      ctrl.enqueue(new TextEncoder().encode(`${frame}\n`)),
    get cancelled() {
      return cancelled;
    },
  };
};

/** An entry whose patch applies lines beginning with `fill`. */
const makeEntry = (
  applied: string[],
  result: (source: string) => true | string = (source) => {
    if (!source.startsWith("fill")) throw new Error("apply failed");
    return true;
  },
): PersistedEntry => ({
  patch: () => (source: string) => {
    applied.push(source);
    return result(source);
  },
  echo: () => ({ regions: {} }),
});

const makeState = (overrides?: Partial<NavigationState>): NavigationState => ({
  appliedUrl: "/list?page=1",
  buildId: "build-1",
  currentId: 1,
  ...overrides,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

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

describe("persisted client navigate()", () => {
  useBrowserGlobals();
  let navigate: typeof import("../runtime/persisted-navigation").navigate;
  before(async () => {
    ({ navigate } = await import("../runtime/persisted-navigation"));
  });
  beforeEach(() => {
    fetchCalls = [];
    navigations.length = 0;
    scrolls = [];
    scrollPos = [0, 0];
    window.history.replaceState(null, "", "/list?page=1");
  });

  function run(
    state: NavigationState,
    href: string,
    entry: PersistedEntry,
    {
      push = true,
      targetId = 2,
      mutation,
      fallbacks = [] as unknown[][],
      load = () => Promise.resolve(entry),
    }: {
      push?: boolean;
      targetId?: number;
      mutation?: Mutation;
      fallbacks?: unknown[][];
      load?: () => Promise<PersistedEntry>;
    } = {},
  ) {
    const target: RouteEntry = [targetId, load];
    return navigate(
      state,
      href,
      push,
      target,
      mutation,
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

  it("treats a completed zero-fill response as applied (all held)", async () => {
    const applied: string[] = [];
    const events: string[] = [];
    window.addEventListener("marko-run:navigate", () =>
      events.push("navigate"),
    );
    // Everything the page holds was claimed and everything hit: the body
    // carries only the feedback comment line.
    fetchImpl = async (href) => patchResponse(["//E1:groupA11111111"], href);
    const state = makeState({ echoValues: "groupA11111111" });
    const entry: PersistedEntry = {
      patch: () => (source: string) => {
        applied.push(source);
        return true;
      },
      echo: (values) => ({ regions: {}, values }),
    };
    await run(state, "http://localhost:3000/item/2", entry);

    // Nothing applied line-wise, yet the navigation advanced whole.
    assert.deepEqual(applied, []);
    assert.equal(state.currentId, 2);
    assert.equal(state.appliedUrl, "/item/2");
    assert.equal(window.location.pathname, "/item/2");
    assert.equal(state.echo, entry.echo);
    assert.equal(state.echoValues, "groupA11111111");
    assert.equal(state.partialApply, false);
    assert.deepEqual(events, ["navigate"]);
  });

  it("treats a zero-fill mutation response as applied without resubmitting", async () => {
    const applied: string[] = [];
    // A PRG whose redirected GET held everything: empty body entirely.
    fetchImpl = async (href) => patchResponse([], href);
    const state = makeState();
    const entry: PersistedEntry = {
      patch: () => (source: string) => {
        applied.push(source);
        return true;
      },
      echo: () => ({ regions: {} }),
    };
    const form = window.document.createElement("form");
    await run(state, "http://localhost:3000/item/2", entry, {
      mutation: [new window.FormData(form), form, null],
    });

    assert.deepEqual(applied, []);
    assert.equal(state.currentId, 2);
    assert.equal(state.appliedUrl, "/item/2");
    assert.equal(fetchCalls[0].init.method, "POST");
  });

  it("does not mark a superseded zero-fill stream applied", async () => {
    const applied: string[] = [];
    const stalled = streamedPatch("http://localhost:3000/item/2");
    fetchImpl = async () => stalled.response;
    const state = makeState();
    const first = run(
      state,
      "http://localhost:3000/item/2",
      makeEntry(applied),
    );
    await flush();
    // A second navigation aborts the first before any chunk arrived.
    fetchImpl = async (href) => patchResponse(["fill-late"], href);
    await run(state, "http://localhost:3000/other", makeEntry(applied), {
      targetId: 3,
    });
    // The stalled stream only now yields; the aborted navigation must
    // return without marking itself applied.
    stalled.enqueue("fill-late-superseded");
    await first;

    // The superseded stream never marked applied; the live navigation owns
    // the page.
    assert.equal(state.currentId, 3);
    assert.equal(state.appliedUrl, "/other");
    assert.deepEqual(applied, ["fill-late"]);
  });

  it("echoes possessions and commits feedback only after apply", async () => {
    const applied: string[] = [];
    const state = makeState();
    // First navigation: nothing applied yet, so no echo field ships.
    fetchImpl = async (href) => patchResponse(["fill-1"], href);
    const echoReceived: (string | undefined)[] = [];
    const entry: PersistedEntry = {
      // The carrier hands committed value feedback to the snapshot (which
      // prunes dead-anchor claims) and encodes only what comes back.
      echo: (values) => (
        echoReceived.push(values),
        {
          regions: { 'a5|k"x"': "0123456789abcdef" },
          values: values && `pruned:${values}`,
        }
      ),
      patch: () => (source) => (applied.push(source), true),
    };
    await run(state, "http://localhost:3000/item/2", entry);
    assert.equal(
      (fetchCalls[0].init.headers as Record<string, string>)["x-marko-echo"],
      undefined,
    );

    // Second navigation echoes the applied entry's possessions; the
    // response's value feedback rides a trailing comment line and commits
    // only after every frame applied.
    fetchImpl = async (href) =>
      patchResponse(["fill-2", "//E1:c-feedback"], href);
    await run(state, "http://localhost:3000/item/3", entry, { targetId: 3 });
    const echoed = (fetchCalls[1].init.headers as Record<string, string>)[
      "x-marko-echo"
    ];
    assert.ok(echoed?.startsWith("E1."), `echo header missing: ${echoed}`);
    assert.equal(state.echoValues, "c-feedback");

    // Third navigation replays the committed feedback inside the envelope.
    fetchImpl = async (href) => patchResponse(["fill-3"], href);
    await run(state, "http://localhost:3000/item/4", entry, { targetId: 4 });
    const third = (fetchCalls[2].init.headers as Record<string, string>)[
      "x-marko-echo"
    ];
    assert.ok(third!.length > echoed!.length, "feedback not replayed");
    assert.deepEqual(echoReceived, [undefined, "c-feedback"]);
    assert.equal(
      third!.slice(3).split(";")[0],
      "pruned:c-feedback",
      "the echoed value section must be the snapshot's, not the raw store",
    );
    assert.deepEqual(applied, ["fill-1", "fill-2", "fill-3"]);
  });

  it("merges delta feedback and clears the store on route change", async () => {
    const state = makeState();
    const entry: PersistedEntry = {
      echo: (values) => ({ regions: {}, values }),
      patch: () => () => true,
    };
    // Two same-route hops: the second's delta updates one group and the
    // merged store keeps the other (absent means keep).
    fetchImpl = async (href) =>
      patchResponse(["f", `//E1:${CLAIM_A}.${CLAIM_B}`], href);
    await run(state, "http://localhost:3000/item/2", entry);
    fetchImpl = async (href) => patchResponse(["f", `//E1:${CLAIM_A2}`], href);
    await run(state, "http://localhost:3000/item/3", entry);
    assert.equal(state.echoValues, `${CLAIM_B}.${CLAIM_A2}`);
    // An empty feedback line is not a clear.
    fetchImpl = async (href) => patchResponse(["f", "//E1:"], href);
    await run(state, "http://localhost:3000/item/4", entry);
    assert.equal(state.echoValues, `${CLAIM_B}.${CLAIM_A2}`);
    // A route change clears the committed store wholesale before commit.
    fetchImpl = async (href) => patchResponse(["f", `//E1:${CLAIM_Z}`], href);
    await run(state, "http://localhost:3000/cart", entry, { targetId: 9 });
    assert.equal(state.echoValues, CLAIM_Z);
  });

  it("does not advance the page when frame application fails", async () => {
    fetchImpl = async (href) => patchResponse(["fail"], href);
    const state = makeState();
    const fallbacks: unknown[][] = [];
    await run(
      state,
      "http://localhost:3000/item/2",
      makeEntry([], () => {
        throw new Error("apply failed");
      }),
      { fallbacks },
    );
    assert.equal(state.currentId, 1);
    assert.equal(fallbacks.length, 1);
  });

  it("loads the target entry concurrently with the request", async () => {
    let resolveEntry!: (entry: PersistedEntry) => void;
    const entry = makeEntry([]);
    const loading = new Promise<PersistedEntry>((resolve) => {
      resolveEntry = resolve;
    });
    fetchImpl = async () => patchResponse(["fill"]);
    const navigation = run(makeState(), "http://localhost:3000/item/2", entry, {
      load: () => loading,
    });
    await Promise.resolve();
    assert.equal(fetchCalls.length, 1);
    resolveEntry(entry);
    await navigation;
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

  it("scrolls to a percent-encoded fragment's anchor", async () => {
    const anchor = window.document.createElement("div");
    anchor.id = "my section";
    let scrolledIntoView = 0;
    (anchor as any).scrollIntoView = () => scrolledIntoView++;
    window.document.body.append(anchor);
    fetchImpl = async () =>
      patchResponse(["fill"], "http://localhost:3000/item/2");
    await run(
      makeState(),
      "http://localhost:3000/item/2#my%20section",
      makeEntry([]),
    );
    assert.equal(scrolledIntoView, 1);
    assert.deepEqual(scrolls, []);
    anchor.remove();
  });

  it("falls back to the raw id for a malformed fragment", async () => {
    const anchor = window.document.createElement("div");
    anchor.id = "100%";
    let scrolledIntoView = 0;
    (anchor as any).scrollIntoView = () => scrolledIntoView++;
    window.document.body.append(anchor);
    fetchImpl = async () =>
      patchResponse(["fill"], "http://localhost:3000/item/2");
    // "100%" is not decodable; the navigation must not fail over it.
    await run(makeState(), "http://localhost:3000/item/2#100%", makeEntry([]));
    assert.equal(scrolledIntoView, 1);
    anchor.remove();
  });

  it("does not push history when the applied URL is unchanged", async () => {
    fetchImpl = async () =>
      patchResponse(["fill"], "http://localhost:3000/list?page=1");
    const before = window.history.length;
    await run(makeState(), "http://localhost:3000/list?page=1", makeEntry([]));
    assert.equal(window.history.length, before);
  });

  it("creates no history entry for a navigation superseded before its first frame", async () => {
    const applied: string[] = [];
    const fallbacks: unknown[][] = [];
    // Guarantee this entry is the newest so history length deltas are exact.
    window.history.pushState(null, "", "/list?page=1");
    const before = window.history.length;
    const stalled = streamedPatch("http://localhost:3000/item/2");
    fetchImpl = async () => stalled.response;
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
    // Initiation alone commits nothing: no entry, no URL movement.
    assert.equal(window.history.length, before);
    assert.equal(
      window.location.pathname + window.location.search,
      "/list?page=1",
    );

    fetchImpl = async () =>
      patchResponse(["fill-second"], "http://localhost:3000/item/3");
    const second = run(
      state,
      "http://localhost:3000/item/3",
      makeEntry(applied),
      { targetId: 3, fallbacks },
    );
    await flush();
    // The superseded stream delivers its first frame only after the newer
    // navigation applied; nothing from it may land.
    stalled.enqueue("fill-late");
    await Promise.all([first, second]);

    assert.ok((fetchCalls[0].init.signal as AbortSignal).aborted);
    assert.deepEqual(applied, ["fill-second"]);
    assert.equal(window.history.length, before + 1);
    assert.equal(window.location.pathname, "/item/3");
    assert.deepEqual(fallbacks, []);

    // Back skips any phantom entry for the superseded navigation and lands
    // on the origin page, as after a browser-aborted navigation.
    window.history.back();
    await flush();
    await flush();
    assert.equal(
      window.location.pathname + window.location.search,
      "/list?page=1",
    );
  });

  it("keeps the entry of a superseded navigation that already applied a frame", async () => {
    const applied: string[] = [];
    const fallbacks: unknown[][] = [];
    window.history.pushState(null, "", "/list?page=1");
    const before = window.history.length;
    const stalled = streamedPatch("http://localhost:3000/item/2");
    fetchImpl = async () => stalled.response;
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
    stalled.enqueue("fill-first");
    await flush();
    // A frame applied: the page committed, like a browser rendering the
    // response's first bytes, so this navigation owns a history entry.
    assert.equal(window.location.pathname, "/item/2");
    assert.equal(window.history.length, before + 1);

    // The user scrolls the committed page before superseding it.
    scrollPos = [7, 220];
    fetchImpl = async () =>
      patchResponse(["fill-second"], "http://localhost:3000/item/3");
    const second = run(
      state,
      "http://localhost:3000/item/3",
      makeEntry(applied),
      { targetId: 3, fallbacks },
    );
    await flush();
    stalled.enqueue("fill-late");
    await Promise.all([first, second]);

    assert.deepEqual(applied, ["fill-first", "fill-second"]);
    assert.equal(window.history.length, before + 2);
    assert.deepEqual(fallbacks, []);

    // Back returns to the superseded page's entry, carrying the scroll
    // recorded when it was departed mid-stream.
    window.history.back();
    await flush();
    await flush();
    assert.equal(window.location.pathname, "/item/2");
    assert.deepEqual(window.history.state, { "marko-run:scroll": [7, 220] });
    window.history.back();
    await flush();
    await flush();
    assert.equal(
      window.location.pathname + window.location.search,
      "/list?page=1",
    );
  });

  it("drops committed value claims when a partial apply is superseded", async () => {
    const applied: string[] = [];
    const stalled = streamedPatch("http://localhost:3000/item/2");
    fetchImpl = async () => stalled.response;
    const state = makeState();
    // Committed claims from an earlier fully-applied response.
    state.echoValues = "stale-claims";
    const first = run(
      state,
      "http://localhost:3000/item/2",
      makeEntry(applied),
    );
    await flush();
    stalled.enqueue("fill-first");
    await flush();

    // Supersede mid-stream: the live page diverged from the claims, so the
    // next request must not echo them (they could HIT against content the
    // page no longer holds).
    fetchImpl = async (href) => patchResponse(["fill-second"], href);
    const second = run(
      state,
      "http://localhost:3000/item/3",
      makeEntry(applied),
      {
        targetId: 3,
      },
    );
    await flush();
    stalled.enqueue("fill-late");
    await Promise.all([first, second]);

    const headers = fetchCalls[1].init.headers as Record<string, string>;
    assert.equal(
      headers["x-marko-echo"],
      undefined,
      "a partially-applied page must not echo prior value claims",
    );
    // An UNsuperseded full apply keeps committing normally.
    fetchImpl = async (href) =>
      patchResponse(["fill-third", "//E1:fresh"], href);
    await run(state, "http://localhost:3000/item/4", makeEntry(applied), {
      targetId: 4,
    });
    assert.equal(state.echoValues, "fresh");
  });

  // --- server-issued claim sets (E2) ---

  const ID_A = "AAAAAAAAAAAAAAAAAAAAAA";
  const ID_B = "BBBBBBBBBBBBBBBBBBBBBB";
  /** The e1-base fingerprint, implemented independently of the runtime:
   * a drifted algorithm on either side fails these tests loudly. */
  const fnv = (values: string) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < values.length; i++) {
      hash = Math.imul(hash ^ values.charCodeAt(i), 0x01000193) >>> 0;
    }
    return hash.toString(36);
  };
  /** The ack the server emits: every non-empty base fingerprints exactly
   * what it consumed — the request's id for a hit, the transmitted record
   * subset for e1. */
  const ackHeaders = (
    id: string,
    base: "hit" | "e1" | "empty",
    fp?: string,
  ) => ({
    ...patchHeaders,
    "x-marko-claim-set":
      `E2.${id};base=${base}` + (base === "empty" ? "" : `;fp=${fp}`),
  });
  /** An entry whose echo passes the committed values through unpruned. */
  const passthroughEntry = (applied: string[] = []): PersistedEntry => ({
    echo: (values) => ({ regions: {}, values }),
    patch: () => (source) => (applied.push(source), true),
  });
  /** A state that already applied a patch (its echo is live), as every
   * id-holding page has by construction. */
  const primedState = (overrides?: Partial<NavigationState>) => {
    const state = makeState(overrides);
    state.echo = (values) => ({ regions: {}, values });
    return state;
  };
  const echoHeaderOf = (call: FetchCall) =>
    (call.init.headers as Record<string, string>)["x-marko-echo"];
  const claimSetHeaderOf = (call: FetchCall) =>
    (call.init.headers as Record<string, string>)["x-marko-claim-set"];

  it("commits {id, store} together after EOF and hedges both on the next request", async () => {
    const state = makeState();
    fetchImpl = async (href) =>
      patchResponse(
        ["fill-1", `//E1:${CLAIM_A}.${CLAIM_B}`],
        href,
        ackHeaders(ID_A, "empty"),
      );
    await run(state, "http://localhost:3000/item/2", passthroughEntry());
    assert.equal(state.claimSetId, ID_A);
    assert.equal(state.echoValues, `${CLAIM_A}.${CLAIM_B}`);

    // The next request hedges: the id on its own header, the echo pure E1.
    fetchImpl = async (href) =>
      patchResponse(
        ["fill-2", `//E1:${CLAIM_A2}`],
        href,
        // The hit ack names the id it consumed: exactly the one sent.
        ackHeaders(ID_B, "hit", fnv(ID_A)),
      );
    await run(state, "http://localhost:3000/item/3", passthroughEntry(), {
      targetId: 2,
    });
    assert.equal(claimSetHeaderOf(fetchCalls[1]), `E2.${ID_A}`);
    assert.equal(echoHeaderOf(fetchCalls[1]), `E1.${CLAIM_A}.${CLAIM_B}`);
    // base=hit: rebuilt from the full store the id named, plus the delta.
    assert.equal(state.claimSetId, ID_B);
    assert.equal(state.echoValues, `${CLAIM_B}.${CLAIM_A2}`);
  });

  it("the hedge is byte-identical to an id-less client's request", async () => {
    // The id rides its own header, so it must cost the echo NOTHING: same
    // store, with and without a committed id, must produce the same
    // x-marko-echo down to the byte — even when the field sheds.
    const store = Array.from(
      { length: 60 },
      (_, i) => `key-${i}-x` + "D".repeat(digestWidth),
    ).join(".");
    fetchImpl = async (href) => patchResponse(["fill"], href);
    await run(
      primedState({ echoValues: store, claimSetId: ID_A }),
      "http://localhost:3000/list?page=2",
      passthroughEntry(),
      { targetId: 1 },
    );
    await run(
      primedState({ echoValues: store }),
      "http://localhost:3000/list?page=2",
      passthroughEntry(),
      { targetId: 1 },
    );
    assert.equal(claimSetHeaderOf(fetchCalls[0]), `E2.${ID_A}`);
    assert.equal(claimSetHeaderOf(fetchCalls[1]), undefined);
    assert.equal(echoHeaderOf(fetchCalls[0]), echoHeaderOf(fetchCalls[1]));
    assert.ok(echoHeaderOf(fetchCalls[0]).startsWith("E1."));
  });

  it("liveness pruning invalidates the id and sends the pruned E1 form", async () => {
    // The run-side rule: ANY difference between the committed store and
    // the snapshot's pruned values drops the id. The three real prune
    // behaviors behind that difference are pinned against marko's actual
    // DOM runtime by its fixtures (destroyed anchor:
    // persisted-prune-destroyed-anchor; parked lazy delivery:
    // persisted-lazy-settle-claim); this test drives the rule itself.
    for (const prune of [
      { from: `${CLAIM_A}.${CLAIM_B}`, to: CLAIM_B },
      { from: CLAIM_A, to: "" },
    ]) {
      const state = makeState({ echoValues: prune.from, claimSetId: ID_A });
      state.echo = (values) => ({
        regions: {},
        values: values && prune.to,
      });
      fetchImpl = async (href) => patchResponse(["fill"], href);
      await run(state, "http://localhost:3000/item/2", passthroughEntry());
      const call = fetchCalls.at(-1)!;
      assert.equal(
        claimSetHeaderOf(call),
        undefined,
        `pruned request must not carry the id (${prune.from} -> ${prune.to})`,
      );
      const echoed = echoHeaderOf(call);
      assert.ok(!echoed || echoed.startsWith("E1."), echoed);
      assert.equal(state.claimSetId, undefined, "id must drop with the prune");
    }
  });

  it("keeps the id when pruning changed nothing (empty store included)", async () => {
    const state = primedState({ claimSetId: ID_A });
    fetchImpl = async (href) => patchResponse(["fill"], href);
    await run(state, "http://localhost:3000/item/2", passthroughEntry());
    assert.equal(claimSetHeaderOf(fetchCalls[0]), `E2.${ID_A}`);
    assert.equal(echoHeaderOf(fetchCalls[0]), undefined);
  });

  it("a superseded partial apply clears the id and store; pre-frame supersession keeps them", async () => {
    // After a frame applied: both drop (the DOM diverged from the store).
    const applied: string[] = [];
    const stalled = streamedPatch("http://localhost:3000/item/2");
    fetchImpl = async () => stalled.response;
    const state = primedState({
      echoValues: CLAIM_A,
      claimSetId: ID_A,
    });
    const first = run(
      state,
      "http://localhost:3000/item/2",
      passthroughEntry(applied),
    );
    await flush();
    stalled.enqueue("fill-first");
    await flush();
    fetchImpl = async (href) => patchResponse(["fill-second"], href);
    const second = run(
      state,
      "http://localhost:3000/item/3",
      passthroughEntry(applied),
      {
        targetId: 3,
      },
    );
    await flush();
    stalled.enqueue("fill-late");
    await Promise.all([first, second]);
    assert.equal(
      echoHeaderOf(fetchCalls[1]),
      undefined,
      "the superseding request must carry no claims",
    );
    assert.equal(
      claimSetHeaderOf(fetchCalls[1]),
      undefined,
      "the superseding request must carry no id",
    );

    // Superseded before any frame: the id remains valid and rides again.
    const stalled2 = streamedPatch("http://localhost:3000/item/2");
    fetchImpl = async () => stalled2.response;
    const state2 = primedState({ echoValues: CLAIM_A, claimSetId: ID_A });
    const first2 = run(
      state2,
      "http://localhost:3000/item/2",
      passthroughEntry(),
    );
    await flush();
    fetchImpl = async (href) => patchResponse(["fill-x"], href);
    const second2 = run(
      state2,
      "http://localhost:3000/item/3",
      passthroughEntry(),
      {
        targetId: 3,
      },
    );
    await flush();
    stalled2.enqueue("fill-late");
    await Promise.all([first2, second2]);
    assert.equal(claimSetHeaderOf(fetchCalls.at(-1)!), `E2.${ID_A}`);
    assert.equal(echoHeaderOf(fetchCalls.at(-1)!), `E1.${CLAIM_A}`);
  });

  it("a miss (base=empty) resets the merge base instead of merging locally", async () => {
    const state = primedState({
      echoValues: `${CLAIM_A}.${CLAIM_B}`,
      claimSetId: ID_A,
    });
    fetchImpl = async (href) =>
      patchResponse(
        ["fill", `//E1:${CLAIM_C}`],
        href,
        ackHeaders(ID_B, "empty"),
      );
    // Same-route, id sent, server missed (evicted/foreign instance).
    await run(state, "http://localhost:3000/list?page=2", passthroughEntry(), {
      targetId: 1,
    });
    // The server computed from empty; keeping b/a would over-claim.
    assert.equal(state.echoValues, CLAIM_C);
    assert.equal(state.claimSetId, ID_B);
  });

  it("base=e1 with a matching fingerprint rebuilds from exactly the transmitted subset", async () => {
    // A store too large for the header: encodeEcho sheds, and the ack's
    // e1 base must be the survivors — not the full local store. The
    // server fingerprints the subset it consumed; only a match commits.
    const store = Array.from(
      { length: 60 },
      (_, i) => `key-${i}-x` + "D".repeat(digestWidth),
    ).join(".");
    const state = primedState({ echoValues: store, claimSetId: ID_A });
    fetchImpl = async (href, init) => {
      const echoed = (init.headers as Record<string, string>)["x-marko-echo"];
      const transmitted = echoed.slice(3).split(";")[0];
      return patchResponse(
        ["fill", `//E1:${CLAIM_Z}`],
        href,
        ackHeaders(ID_B, "e1", fnv(transmitted)),
      );
    };
    await run(state, "http://localhost:3000/list?page=2", passthroughEntry(), {
      targetId: 1,
    });
    const echoed = echoHeaderOf(fetchCalls[0]);
    assert.ok(echoed.startsWith("E1."), echoed);
    assert.equal(claimSetHeaderOf(fetchCalls[0]), `E2.${ID_A}`);
    const transmitted = echoed.slice(3).split(";")[0];
    assert.ok(
      transmitted.split(".").length < 60,
      "the corpus never exercised shedding",
    );
    assert.equal(state.echoValues, `${transmitted}.${CLAIM_Z}`);
    assert.equal(state.claimSetId, ID_B);
  });

  it("a divergent e1 fingerprint discards the id and keeps E1 merge semantics", async () => {
    // An intermediary rewrote the echo (or a skewed server read another
    // subset): the id would name a store the client cannot prove, so it
    // must not commit — the store keeps today's local-merge semantics.
    const state = primedState({
      echoValues: `${CLAIM_A}.${CLAIM_B}`,
      claimSetId: ID_A,
    });
    fetchImpl = async (href) =>
      patchResponse(
        ["fill", `//E1:${CLAIM_A2}`],
        href,
        ackHeaders(ID_B, "e1", fnv("something-else")),
      );
    await run(state, "http://localhost:3000/list?page=2", passthroughEntry(), {
      targetId: 1,
    });
    assert.equal(state.claimSetId, undefined);
    assert.equal(state.echoValues, `${CLAIM_B}.${CLAIM_A2}`);
  });

  it("an ack the request cannot support discards the id", async () => {
    // base=hit while this request sent no id at all (hostile or buggy
    // server, or a worker that replayed someone else's header): if that
    // id names a larger server store, a later hit would elide claims this
    // client never held — never adopt it. The store keeps plain E1 merge.
    const state = primedState({ echoValues: CLAIM_A });
    fetchImpl = async (href) =>
      patchResponse(
        ["fill", `//E1:${CLAIM_B}`],
        href,
        ackHeaders(ID_B, "hit", fnv(ID_A)),
      );
    await run(state, "http://localhost:3000/list?page=2", passthroughEntry(), {
      targetId: 1,
    });
    assert.equal(state.claimSetId, undefined);
    assert.equal(state.echoValues, `${CLAIM_A}.${CLAIM_B}`);
  });

  it("a hit ack naming another live id discards the id", async () => {
    // The correlation escape: this client sent id A and kept store A, but
    // a skewed service worker replayed another live same-route request
    // carrying id X. The server resolves X, binds the next id from store
    // X, and acks the base it consumed. Having sent *an* id is no proof:
    // rebuilding B from store A would let the next hit elide by X while
    // the page claims by A — so a hit commits only when it names THIS
    // request's id.
    const ID_X = "XXXXXXXXXXXXXXXXXXXXXX";
    const state = primedState({ echoValues: CLAIM_A, claimSetId: ID_A });
    fetchImpl = async (href) =>
      patchResponse(
        ["fill", `//E1:${CLAIM_B}`],
        href,
        ackHeaders(ID_B, "hit", fnv(ID_X)),
      );
    await run(state, "http://localhost:3000/list?page=2", passthroughEntry(), {
      targetId: 1,
    });
    assert.equal(claimSetHeaderOf(fetchCalls[0]), `E2.${ID_A}`);
    assert.equal(state.claimSetId, undefined, "adopted an uncorrelated id");
    assert.equal(state.echoValues, `${CLAIM_A}.${CLAIM_B}`);
  });

  it("a hit ack that identifies no id at all discards the id", async () => {
    // An ack that merely says `hit` proves nothing about WHICH id the
    // server consumed; the base must be identified or the id is refused.
    const state = primedState({ echoValues: CLAIM_A, claimSetId: ID_A });
    fetchImpl = async (href) =>
      patchResponse(["fill", `//E1:${CLAIM_B}`], href, {
        ...patchHeaders,
        "x-marko-claim-set": `E2.${ID_B};base=hit`,
      });
    await run(state, "http://localhost:3000/list?page=2", passthroughEntry(), {
      targetId: 1,
    });
    assert.equal(state.claimSetId, undefined);
    assert.equal(state.echoValues, `${CLAIM_A}.${CLAIM_B}`);
  });

  it("cross-route: only an empty-base ack commits; anything else discards the id", async () => {
    // The server forces base=empty cross-route (marko refuses cross-route
    // claims); a protocol-violating hit ack must not be adopted.
    const state = primedState({ echoValues: "oldRouteA", claimSetId: ID_A });
    fetchImpl = async (href) =>
      patchResponse(
        ["fill", "//E1:newRouteB"],
        href,
        ackHeaders(ID_B, "hit", fnv(ID_A)),
      );
    await run(state, "http://localhost:3000/cart", passthroughEntry(), {
      targetId: 9,
    });
    assert.equal(state.claimSetId, undefined);
    assert.equal(state.echoValues, "newRouteB");

    // The honest cross-route ack (base=empty) commits a route-clean pair.
    const honest = primedState({ echoValues: "oldRouteA", claimSetId: ID_A });
    fetchImpl = async (href) =>
      patchResponse(
        ["fill", "//E1:newRouteB"],
        href,
        ackHeaders(ID_B, "empty"),
      );
    await run(honest, "http://localhost:3000/cart", passthroughEntry(), {
      targetId: 9,
    });
    assert.equal(honest.claimSetId, ID_B);
    assert.equal(honest.echoValues, "newRouteB");
  });

  it("without an ack the client holds no id and keeps E1 semantics", async () => {
    const state = primedState({
      echoValues: `${CLAIM_A}.${CLAIM_B}`,
      claimSetId: ID_A,
    });
    // Kill switch, stripped header, or an older server: plain E1 merge.
    fetchImpl = async (href) =>
      patchResponse(["fill", `//E1:${CLAIM_A2}`], href);
    await run(state, "http://localhost:3000/list?page=2", passthroughEntry(), {
      targetId: 1,
    });
    assert.equal(state.echoValues, `${CLAIM_B}.${CLAIM_A2}`);
    assert.equal(state.claimSetId, undefined);
  });

  it("an id header with a truncated body clears {id, store}", async () => {
    const state = primedState({ echoValues: CLAIM_A, claimSetId: ID_A });
    fetchImpl = async (href) => {
      let pulls = 0;
      const response = new Response(
        new ReadableStream<Uint8Array>({
          pull(ctrl) {
            if (pulls++) ctrl.error(new Error("connection lost"));
            else ctrl.enqueue(new TextEncoder().encode("fill-1\n"));
          },
        }),
        { headers: ackHeaders(ID_B, "hit", fnv(ID_A)) },
      );
      Object.defineProperty(response, "url", { value: href });
      return response;
    };
    await run(state, "http://localhost:3000/item/2", passthroughEntry());
    // The apply failed mid-stream: the DOM diverged from everything the
    // committed claims describe, so BOTH the old id and the old store
    // must be gone (not merely the acked id refused) before the
    // document replacement lands.
    assert.deepEqual(navigations, ["replace:http://localhost:3000/item/2"]);
    assert.equal(state.claimSetId, undefined);
    assert.equal(state.echoValues, undefined);
  });

  it("an applied frame with no completion marker invalidates the store, not just the id", async () => {
    // A service worker or proxy that closes the stream after a frame
    // prefix produces a clean EOF the Fetch API cannot distinguish from
    // success — only the mandatory `//E1:` footer can. The applied frame
    // moved group A to B while the response's feedback for B never
    // arrived: keeping store A would let a later navigation echo A, the
    // server elide the group, and B stay on screen forever. Refusing only
    // the new id is not enough — the store cannot commit either, and the
    // page (applied, incomplete) is replaced like any failed apply.
    const applied: string[] = [];
    const state = primedState({
      echoValues: CLAIM_A,
      claimSetId: ID_A,
    });
    fetchImpl = async (href) =>
      truncatedPatch(["fill-1"], href, ackHeaders(ID_B, "hit", fnv(ID_A)));
    await run(
      state,
      "http://localhost:3000/item/2",
      passthroughEntry(applied),
      {
        targetId: 1,
      },
    );
    assert.deepEqual(applied, ["fill-1"]);
    assert.equal(state.claimSetId, undefined);
    assert.equal(state.echoValues, undefined, "stale claims survived");
    assert.deepEqual(navigations, ["replace:http://localhost:3000/item/2"]);
  });

  it("content after the completion marker is never applied and never commits", async () => {
    // The marker is valid only as the FINAL content before EOF. A stream
    // that continues past it was rewritten in transit, so its tail is not
    // applied and neither the id nor the store may commit — the applied
    // prefix leaves the page diverged exactly as a truncation does.
    const applied: string[] = [];
    const state = primedState({ echoValues: CLAIM_A, claimSetId: ID_A });
    fetchImpl = async (href) =>
      truncatedPatch(
        ["fill-1", `//E1:${CLAIM_B}`, "fill-2"],
        href,
        ackHeaders(ID_B, "hit", fnv(ID_A)),
      );
    await run(
      state,
      "http://localhost:3000/item/2",
      passthroughEntry(applied),
      {
        targetId: 1,
      },
    );
    assert.deepEqual(applied, ["fill-1"], "applied a frame past the marker");
    assert.equal(state.claimSetId, undefined);
    assert.equal(state.echoValues, undefined, "stale claims survived");
    assert.deepEqual(navigations, ["replace:http://localhost:3000/item/2"]);
  });

  it("a body truncated before any frame falls back instead of advancing", async () => {
    // Nothing applied and no marker: the navigation must not advance to a
    // page that never arrived. A document load answers it, and the
    // unapplied sink clears {id, store} fail-closed — a frame is not
    // atomic, so "nothing applied" cannot prove "nothing changed".
    const applied: string[] = [];
    const fallbacks: unknown[][] = [];
    const state = primedState({ echoValues: CLAIM_A, claimSetId: ID_A });
    fetchImpl = async (href) =>
      truncatedPatch([], href, ackHeaders(ID_B, "hit", fnv(ID_A)));
    await run(
      state,
      "http://localhost:3000/item/2",
      passthroughEntry(applied),
      {
        targetId: 1,
        fallbacks,
      },
    );
    assert.deepEqual(applied, []);
    assert.equal(fallbacks.length, 1);
    assert.equal(state.currentId, 1, "advanced on a truncated body");
    assert.equal(state.appliedUrl, "/list?page=1");
    assert.equal(state.claimSetId, undefined);
    assert.equal(state.echoValues, undefined);
  });

  it("commits on a bare marker: an all-held body is complete", async () => {
    // The other side of the rule — the marker alone (empty delta, zero
    // frames) is a COMPLETE response and commits {id, store} normally.
    const state = primedState({ echoValues: CLAIM_A, claimSetId: ID_A });
    fetchImpl = async (href) =>
      truncatedPatch(["//E1:"], href, ackHeaders(ID_B, "hit", fnv(ID_A)));
    await run(state, "http://localhost:3000/list?page=2", passthroughEntry(), {
      targetId: 1,
    });
    assert.equal(state.claimSetId, ID_B);
    assert.equal(state.echoValues, CLAIM_A);
    assert.deepEqual(navigations, []);
  });

  it("a lazy-module failure after commit clears the committed {id, store}", async () => {
    // EOF + full apply committed {id, store}; then a chunk the applied
    // patch needs rejects (deploy skew). The page document-replaces — and
    // the just-committed pair must drop synchronously first, before any
    // later navigation could echo an id for a DOM the page never reached.
    const sinks: ((error: unknown) => void)[] = [];
    const entry: PersistedEntry = {
      echo: (values) => ({ regions: {}, values }),
      patch: (fail) => {
        sinks.push(fail!);
        return () => true;
      },
    };
    const state = primedState({ echoValues: CLAIM_A, claimSetId: ID_A });
    fetchImpl = async (href) =>
      patchResponse(
        ["fill", `//E1:${CLAIM_B}`],
        href,
        ackHeaders(ID_B, "hit", fnv(ID_A)),
      );
    await run(state, "http://localhost:3000/item/2", passthroughEntry(), {
      targetId: 1,
      load: () => Promise.resolve(entry),
    });
    assert.equal(state.claimSetId, ID_B);
    assert.equal(state.echoValues, `${CLAIM_A}.${CLAIM_B}`);

    sinks[0](new Error("failed to fetch dynamically imported module"));
    assert.deepEqual(navigations, ["replace:http://localhost:3000/item/2"]);
    assert.equal(state.claimSetId, undefined);
    assert.equal(state.echoValues, undefined);
  });

  it("a raw throw on the first frame clears {id, store} before falling back", async () => {
    // The first frame is not atomic: `_update_load` inserts its branch
    // before running the construct pass, which does not catch raw
    // exceptions. The navigation is still unapplied, so the ordinary
    // fallback runs — but the DOM already moved past what the committed
    // claims describe, so the pair drops before the fallback is scheduled.
    const fallbacks: unknown[][] = [];
    const state = primedState({ echoValues: CLAIM_A, claimSetId: ID_A });
    const entry: PersistedEntry = {
      echo: (values) => ({ regions: {}, values }),
      patch: () => (source) => {
        window.document.body.append(window.document.createElement("section"));
        throw new Error(`construct threw applying ${source}`);
      },
    };
    fetchImpl = async (href) =>
      patchResponse(["fill-1"], href, ackHeaders(ID_B, "hit", fnv(ID_A)));
    await run(state, "http://localhost:3000/item/2", entry, { fallbacks });

    assert.equal(fallbacks.length, 1);
    assert.deepEqual(navigations, []);
    assert.equal(state.claimSetId, undefined, "a stale id survived");
    assert.equal(state.echoValues, undefined, "stale claims survived");
  });

  it("records the departed scroll into history state without clobbering app state", async () => {
    window.history.replaceState({ app: 1 }, "", "/list?page=1");
    scrollPos = [3, 640];
    fetchImpl = async (href) => patchResponse(["fill"], href);
    await run(makeState(), "http://localhost:3000/item/2", makeEntry([]));
    // The freshly pushed entry itself carries no record.
    assert.equal(window.history.state, null);
    window.history.back();
    await flush();
    await flush();
    assert.deepEqual(window.history.state, {
      app: 1,
      "marko-run:scroll": [3, 640],
    });
  });

  it("leaves non-mergeable app history state untouched", async () => {
    window.history.replaceState("opaque", "", "/list?page=1");
    fetchImpl = async (href) => patchResponse(["fill"], href);
    await run(makeState(), "http://localhost:3000/item/2", makeEntry([]));
    window.history.back();
    await flush();
    await flush();
    assert.equal(window.history.state, "opaque");
  });

  it("restores the recorded position after a traversal patch settles", async () => {
    window.history.replaceState(
      { "marko-run:scroll": [3, 512] },
      "",
      "/list?page=1",
    );
    fetchImpl = async (href) => patchResponse(["fill"], href);
    await run(
      makeState({ appliedUrl: "/item/2" }),
      "http://localhost:3000/list?page=1",
      makeEntry([]),
      { push: false, targetId: 1 },
    );
    assert.deepEqual(scrolls, [[3, 512]]);
  });

  it("scrolls a traversal without a recorded position to the top", async () => {
    fetchImpl = async (href) => patchResponse(["fill"], href);
    await run(
      makeState({ appliedUrl: "/item/2" }),
      "http://localhost:3000/list?page=1",
      makeEntry([]),
      { push: false, targetId: 1 },
    );
    assert.deepEqual(scrolls, [[0, 0]]);
  });

  it("keeps focus on a surviving input across a same-route validation patch", async () => {
    const input = window.document.createElement("input");
    window.document.body.append(input);
    input.focus();
    fetchImpl = async () =>
      patchResponse(["fill"], "http://localhost:3000/list?page=1");
    const mutation = [
      new window.URLSearchParams("a=1"),
      {},
      null,
    ] as unknown as Mutation;
    await run(makeState(), "http://localhost:3000/list?page=1", makeEntry([]), {
      targetId: 1,
      mutation,
    });
    assert.equal(window.document.activeElement, input);
    assert.deepEqual(scrolls, []);
    input.remove();
  });

  it("does not steal focus while typing during a same-route multi-frame patch", async () => {
    const input = window.document.createElement("input");
    window.document.body.append(input);
    input.focus();
    input.value = "so";
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    fetchImpl = async () => {
      const response = new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            ctrl = c;
            c.enqueue(new TextEncoder().encode("fill-1\n"));
          },
        }),
        { headers: patchHeaders },
      );
      Object.defineProperty(response, "url", {
        value: "http://localhost:3000/list?page=2",
      });
      return response;
    };
    const navigation = run(
      makeState(),
      "http://localhost:3000/list?page=2",
      makeEntry([]),
      { targetId: 1 },
    );
    await flush();
    // The user keeps typing between frames.
    assert.equal(window.document.activeElement, input);
    input.value = "sock";
    ctrl.enqueue(new TextEncoder().encode("fill-2\n"));
    ctrl.close();
    await navigation;
    assert.equal(window.document.activeElement, input);
    assert.equal(input.value, "sock");
    input.remove();
  });

  it("moves focus to arriving autofocus content when a cross-route patch removes it", async () => {
    // A pre-existing (persistent layout) autofocus element is never chosen.
    const layoutAutofocus = window.document.createElement("input");
    layoutAutofocus.setAttribute("autofocus", "");
    const focused = window.document.createElement("input");
    window.document.body.append(layoutAutofocus, focused);
    focused.focus();
    const arriving = window.document.createElement("input");
    arriving.setAttribute("autofocus", "");
    const entry: PersistedEntry = {
      echo: () => ({ regions: {} }),
      patch: () => () => {
        focused.remove();
        window.document.body.append(arriving);
        return true;
      },
    };
    fetchImpl = async (href) => patchResponse(["fill"], href);
    await run(makeState(), "http://localhost:3000/item/2", entry);
    assert.equal(window.document.activeElement, arriving);
    layoutAutofocus.remove();
    arriving.remove();
  });

  it("focuses the body when a cross-route patch removes focus and no autofocus arrives", async () => {
    const focused = window.document.createElement("input");
    window.document.body.append(focused);
    focused.focus();
    let bodyFocused = 0;
    const bodyFocus = window.document.body.focus;
    window.document.body.focus = () => void bodyFocused++;
    try {
      const entry: PersistedEntry = {
        echo: () => ({ regions: {} }),
        patch: () => () => {
          focused.remove();
          return true;
        },
      };
      fetchImpl = async (href) => patchResponse(["fill"], href);
      await run(makeState(), "http://localhost:3000/item/2", entry);
      assert.equal(bodyFocused, 1);
    } finally {
      window.document.body.focus = bodyFocus;
    }
  });

  it("leaves focus on an element surviving a cross-route patch", async () => {
    const focused = window.document.createElement("input");
    window.document.body.append(focused);
    focused.focus();
    let bodyFocused = 0;
    const bodyFocus = window.document.body.focus;
    window.document.body.focus = () => void bodyFocused++;
    try {
      fetchImpl = async (href) => patchResponse(["fill"], href);
      await run(makeState(), "http://localhost:3000/item/2", makeEntry([]));
      assert.equal(window.document.activeElement, focused);
      assert.equal(bodyFocused, 0);
    } finally {
      window.document.body.focus = bodyFocus;
      focused.remove();
    }
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

  it("applies a patch response that echoes the client's build id", async () => {
    const applied: string[] = [];
    fetchImpl = async (href) => patchResponse(["fill"], href, patchHeaders);
    const state = makeState();
    await run(state, "http://localhost:3000/item/2", makeEntry(applied));
    assert.deepEqual(applied, ["fill"]);
    assert.equal(state.currentId, 2);
  });

  it("falls back without executing script content missing the build echo", async () => {
    // A same-origin redirect can land the patch fetch on a static asset:
    // right content-type, but no framework echo. Its body must never execute.
    const fallbacks: unknown[][] = [];
    let patchFactoryCalls = 0;
    const entry: PersistedEntry = {
      echo: () => ({ regions: {} }),
      patch: () => {
        patchFactoryCalls++;
        return () => true;
      },
    };
    fetchImpl = async () =>
      patchResponse(["alert(1)"], "http://localhost:3000/assets/app.js", {
        "content-type": "text/javascript;charset=UTF-8",
      });
    const state = makeState();
    await run(state, "http://localhost:3000/item/2", entry, { fallbacks });
    assert.equal(patchFactoryCalls, 0);
    assert.equal(state.currentId, 1);
    assert.equal(fallbacks.length, 1);
  });

  it("falls back without executing when the build echo mismatches", async () => {
    const applied: string[] = [];
    const fallbacks: unknown[][] = [];
    fetchImpl = async () =>
      patchResponse(["fill"], "", {
        ...patchHeaders,
        "x-marko-build": "build-2",
      });
    const state = makeState();
    await run(state, "http://localhost:3000/item/2", makeEntry(applied), {
      fallbacks,
    });
    assert.deepEqual(applied, []);
    assert.equal(state.currentId, 1);
    assert.equal(fallbacks.length, 1);
  });

  it("falls back when the first nonempty frame fails", async () => {
    const fallbacks: unknown[][] = [];
    fetchImpl = async () => patchResponse(["skip-a", "skip-b"]);
    await run(makeState(), "http://localhost:3000/item/2", makeEntry([]), {
      fallbacks,
    });
    assert.equal(fallbacks.length, 1);
  });

  it("replaces after a later nonempty frame fails", async () => {
    const fallbacks: unknown[][] = [];
    fetchImpl = async (href) => patchResponse(["fill-1", "fail"], href);
    const state = makeState();
    await run(state, "http://localhost:3000/item/2", makeEntry([]), {
      fallbacks,
    });

    assert.equal(state.currentId, 2);
    assert.equal(window.location.pathname, "/item/2");
    assert.deepEqual(navigations, ["replace:http://localhost:3000/item/2"]);
    assert.deepEqual(fallbacks, []);
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

  /** An entry that applies every line and exposes its failure sink. */
  const makeFailSinkEntry = (sinks: ((error: unknown) => void)[]) =>
    ({
      echo: () => ({ regions: {} }),
      patch: (fail) => {
        sinks.push(fail!);
        return () => true;
      },
    }) satisfies PersistedEntry;

  it("replaces the document when a lazy module load fails post-apply", async () => {
    const sinks: ((error: unknown) => void)[] = [];
    const fallbacks: unknown[][] = [];
    fetchImpl = async (href) => patchResponse(["fill"], href);
    const state = makeState();
    await run(state, "http://localhost:3000/item/2", makeFailSinkEntry(sinks), {
      fallbacks,
    });
    assert.equal(state.currentId, 2);
    assert.deepEqual(navigations, []);

    // Deploy skew: a chunk the applied patch depends on rejects after the
    // navigation already resolved. The partial page must be replaced by the
    // document at the navigation's final URL (a GET, never a resubmission).
    sinks[0](new Error("failed to fetch dynamically imported module"));
    assert.deepEqual(navigations, ["replace:http://localhost:3000/item/2"]);
    assert.deepEqual(fallbacks, []);
  });

  it("ignores a stale navigation's load failure after a newer navigation", async () => {
    const sinks: ((error: unknown) => void)[] = [];
    fetchImpl = async (href) => patchResponse(["fill"], href);
    const state = makeState();
    await run(state, "http://localhost:3000/item/2", makeFailSinkEntry(sinks));

    fetchImpl = async (href) => patchResponse(["fill"], href);
    await run(state, "http://localhost:3000/item/3", makeFailSinkEntry(sinks), {
      targetId: 3,
    });
    assert.equal(state.appliedUrl, "/item/3");

    // The superseded navigation's late failure must not clobber the newer
    // navigation's applied page.
    sinks[0](new Error("failed to fetch dynamically imported module"));
    assert.deepEqual(navigations, []);
    assert.equal(state.appliedUrl, "/item/3");

    // The newest navigation still owns its sink.
    sinks[1](new Error("failed to fetch dynamically imported module"));
    assert.deepEqual(navigations, ["replace:http://localhost:3000/item/3"]);
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

  it("hands the applied prefix's state to an immediately following navigation", async () => {
    const applied: string[] = [];
    const fallbacks: unknown[][] = [];
    const stalled = streamedPatch("http://localhost:3000/item/2");
    fetchImpl = async () => stalled.response;
    const state = makeState();
    const first = run(
      state,
      "http://localhost:3000/item/2",
      makeEntry(applied),
      { fallbacks },
    );
    await flush();
    stalled.enqueue("fill-a1");
    await flush();

    fetchImpl = async () =>
      patchResponse(["fill-b"], "http://localhost:3000/item/3");
    const second = run(
      state,
      "http://localhost:3000/item/3",
      makeEntry(applied),
      { targetId: 3, fallbacks },
    );
    await flush();
    // A second chunk arrives for the superseded stream after the newer
    // navigation began; none of it may apply.
    stalled.enqueue("fill-a2");
    await Promise.all([first, second]);

    assert.ok((fetchCalls[0].init.signal as AbortSignal).aborted);
    assert.ok(!(fetchCalls[1].init.signal as AbortSignal).aborted);
    assert.deepEqual(applied, ["fill-a1", "fill-b"]);
    // The first request described the origin page; the second describes
    // exactly the hybrid page the applied prefix produced: the superseded
    // route's id becomes the new source.
    const originHeaders = fetchCalls[0].init.headers as Record<string, string>;
    assert.equal(originHeaders["x-marko-from"], "1");
    const headers = fetchCalls[1].init.headers as Record<string, string>;
    assert.equal(headers["x-marko-route"], "3");
    assert.equal(headers["x-marko-from"], "2");
    assert.equal(state.appliedUrl, "/item/3");
    assert.equal(window.location.pathname, "/item/3");
    assert.deepEqual(fallbacks, []);
  });

  it("skips a superseded mutation's application without resubmitting", async () => {
    const applied: string[] = [];
    const fallbacks: unknown[][] = [];
    let resolveFetch!: (response: Response) => void;
    fetchImpl = () => new Promise((resolve) => (resolveFetch = resolve));
    const mutation = [
      new window.URLSearchParams("a=1"),
      {},
      null,
    ] as unknown as Mutation;
    const state = makeState();
    const first = run(
      state,
      "http://localhost:3000/list?page=1",
      makeEntry(applied),
      { targetId: 1, mutation, fallbacks },
    );
    await flush();

    fetchImpl = async () =>
      patchResponse(["fill-second"], "http://localhost:3000/item/3");
    await run(state, "http://localhost:3000/item/3", makeEntry(applied), {
      targetId: 3,
      fallbacks,
    });

    // The POST settles only after being superseded. It was never aborted (it
    // may have committed server-side), but its response must not apply, fall
    // back, or resubmit; the body is released unread.
    const late = streamedPatch("http://localhost:3000/list?page=1");
    late.enqueue("fill-mutation");
    resolveFetch(late.response);
    await first;

    assert.equal(fetchCalls[0].init.signal, undefined);
    assert.deepEqual(applied, ["fill-second"]);
    assert.equal(late.cancelled, 1);
    assert.deepEqual(fallbacks, []);
    assert.deepEqual(navigations, []);
    assert.equal(state.appliedUrl, "/item/3");
    assert.equal(window.location.pathname, "/item/3");
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

  it("settles a mutation's fetch after an entry import failure and forwards its response", async () => {
    const fallbacks: unknown[][] = [];
    let resolveFetch!: (response: Response) => void;
    fetchImpl = () => new Promise((resolve) => (resolveFetch = resolve));
    const mutation = [
      new window.URLSearchParams("a=1"),
      {},
      null,
    ] as unknown as Mutation;
    const navigation = run(
      makeState(),
      "http://localhost:3000/list?page=1",
      makeEntry([]),
      {
        targetId: 1,
        mutation,
        fallbacks,
        load: () => Promise.reject(new Error("stale chunk")),
      },
    );
    await flush();
    // The entry import already failed, but the POST may have reached the
    // server: the navigation must keep waiting for its response.
    assert.deepEqual(fallbacks, []);

    const response = new Response("", {
      headers: { "content-type": "text/html" },
    });
    Object.defineProperty(response, "url", {
      value: "http://localhost:3000/final",
    });
    Object.defineProperty(response, "redirected", { value: true });
    resolveFetch(response);
    await navigation;
    assert.equal(fetchCalls.length, 1);
    assert.equal(fallbacks.length, 1);
    // The settled response reaches the fallback so it follows the final URL
    // with GET instead of resubmitting (and re-applying) the mutation.
    assert.equal(fallbacks[0][3], mutation);
    assert.equal(fallbacks[0][4], response);
  });

  it("leaves a mutation on the resubmission path only before a response", async () => {
    const fallbacks: unknown[][] = [];
    fetchImpl = () => Promise.reject(new TypeError("network down"));
    const mutation = [
      new window.URLSearchParams("a=1"),
      {},
      null,
    ] as unknown as Mutation;
    await run(makeState(), "http://localhost:3000/list?page=1", makeEntry([]), {
      targetId: 1,
      mutation,
      fallbacks,
      // Both sides fail; the entry rejection must not leak unhandled.
      load: () => Promise.reject(new Error("stale chunk")),
    });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fallbacks.length, 1);
    assert.equal(fallbacks[0][3], mutation);
    assert.equal(fallbacks[0][4], undefined);
  });

  it("fails a GET fast on an entry import failure without awaiting the fetch", async () => {
    const fallbacks: unknown[][] = [];
    fetchImpl = () => new Promise(() => {});
    await run(makeState(), "http://localhost:3000/item/2", makeEntry([]), {
      fallbacks,
      load: () => Promise.reject(new Error("stale chunk")),
    });
    assert.equal(fallbacks.length, 1);
    assert.equal(fallbacks[0][4], undefined);
  });
});

describe("persisted client traversal scroll", () => {
  useBrowserGlobals(true);
  beforeEach(() => {
    fetchCalls = [];
    navigations.length = 0;
    scrolls = [];
    scrollPos = [0, 0];
    window.history.replaceState(null, "", "/list?page=1");
    window.document.body.innerHTML = "";
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/list?page=1");
  });

  it("holds manual scroll restoration and restores recorded positions across traversals", async () => {
    const { register } = await import("../runtime/persisted.js?traversal");
    const entry: PersistedEntry = {
      patch: () => () => true,
      echo: () => ({ regions: {} }),
    };
    register(
      (pathname: string) =>
        [
          pathname.startsWith("/item") ? 2 : 1,
          () => Promise.resolve(entry),
        ] satisfies RouteEntry,
      1,
      "build-1",
    );
    assert.equal(
      (window.history as { scrollRestoration?: string }).scrollRestoration,
      "manual",
    );

    // Leave /list scrolled down; the fresh navigation lands at the top.
    scrollPos = [0, 300];
    fetchImpl = async (href) => patchResponse(["fill"], href);
    assert.equal(click(link("/item/2")), true);
    await flush();
    assert.equal(window.location.pathname, "/item/2");
    assert.deepEqual(scrolls, [[0, 0]]);

    // Back: the departed /list entry recorded [0, 300]; the traversal patch
    // restores it once settled.
    scrolls = [];
    window.history.back();
    await flush();
    await flush();
    assert.equal(window.location.pathname, "/list");
    assert.deepEqual(scrolls, [[0, 300]]);

    // Forward: the /item entry has no record; the traversal lands at the top.
    scrolls = [];
    window.history.forward();
    await flush();
    await flush();
    assert.equal(window.location.pathname, "/item/2");
    assert.deepEqual(scrolls, [[0, 0]]);
  });
});

describe("persisted client traversal during an in-flight navigation", () => {
  useBrowserGlobals(true);
  beforeEach(() => {
    fetchCalls = [];
    navigations.length = 0;
    scrolls = [];
    scrollPos = [0, 0];
    window.history.replaceState(null, "", "/list?page=1");
    window.document.body.innerHTML = "";
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/list?page=1");
  });

  it("hands the page to the traversal and aborts the in-flight patch", async () => {
    const { register } = await import("../runtime/persisted.js?popstate-wins");
    const applied: string[] = [];
    register(
      (pathname: string) =>
        [
          pathname.startsWith("/item") ? 2 : 1,
          () => Promise.resolve(makeEntry(applied)),
        ] satisfies RouteEntry,
      1,
      "build-1",
    );

    const stalled = streamedPatch("http://localhost:3000/item/2");
    fetchImpl = async () => stalled.response;
    assert.equal(click(link("/item/2")), true);
    await flush();
    assert.equal(fetchCalls.length, 1);

    // Back is pressed while frames are still arriving: the browser has
    // already moved the entry when popstate fires, and the traversal wins.
    fetchImpl = async (href) => patchResponse(["fill-traversal"], href);
    window.history.replaceState(null, "", "/list?page=2");
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await flush();
    stalled.enqueue("fill-late");
    await flush();

    assert.ok((fetchCalls[0].init.signal as AbortSignal).aborted);
    assert.deepEqual(applied, ["fill-traversal"]);
    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[1].href, "http://localhost:3000/list?page=2");
    assert.equal(
      window.location.pathname + window.location.search,
      "/list?page=2",
    );
    // The aborted navigation neither fell back nor produced an entry of its
    // own; the traversal restored its entry's scroll (no record: the top).
    assert.deepEqual(navigations, []);
    assert.deepEqual(scrolls, [[0, 0]]);
  });

  it("aborts an in-flight stream when the page is frozen", async () => {
    const { register } = await import("../runtime/persisted.js?bfcache");
    const applied: string[] = [];
    register(
      (pathname: string) =>
        [
          pathname.startsWith("/item") ? 2 : 1,
          () => Promise.resolve(makeEntry(applied)),
        ] satisfies RouteEntry,
      1,
      "build-1",
    );

    const stalled = streamedPatch("http://localhost:3000/item/2");
    fetchImpl = async () => stalled.response;
    assert.equal(click(link("/item/2")), true);
    await flush();
    const inflight = fetchCalls[fetchCalls.length - 1];

    // The page is frozen mid-stream: a document the browser later
    // resurrects must not keep taking frames from a stream nobody owns.
    window.dispatchEvent(new window.Event("pagehide"));
    await flush();
    stalled.enqueue("fill-after-freeze");
    await flush();

    assert.ok((inflight.init.signal as AbortSignal).aborted);
    assert.deepEqual(applied, []);
  });
});

describe("persisted client interception", () => {
  useBrowserGlobals();
  let routeId: number | undefined = 2;
  const entryApplied: string[] = [];
  let entryLoader: () => Promise<PersistedEntry>;
  before(async () => {
    fetchImpl = async () => patchResponse(["fill"]);
    const { register } = await import("../runtime/persisted");
    register(
      () =>
        routeId === undefined
          ? undefined
          : ([routeId, () => entryLoader()] as RouteEntry),
      1,
      "build-1",
    );
  });
  beforeEach(() => {
    entryLoader = () => Promise.resolve(makeEntry(entryApplied));
    fetchCalls = [];
    navigations.length = 0;
    window.history.replaceState(null, "", "/list?page=1");
    window.document.body.innerHTML = "";
  });

  it("leaves same-document fragment movement native", async () => {
    // Run first so jsdom's popstate still sees the initial `appliedUrl`.
    assert.equal(click(link("/list?page=1#details")), false);
    await flush();
    assert.equal(fetchCalls.length, 0, JSON.stringify(fetchCalls));
  });

  it("leaves an empty-fragment link native", async () => {
    // `<a href="#">` parses to an empty `hash` yet must scroll natively
    // instead of refetching the current page.
    assert.equal(click(link("#")), false);
    await flush();
    assert.equal(fetchCalls.length, 0, JSON.stringify(fetchCalls));

    // An empty fragment pointing at another document is still intercepted.
    fetchImpl = async (href) => patchResponse(["fill"], href);
    assert.equal(click(link("/item/2#")), true);
    await flush();
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].href, "http://localhost:3000/item/2#");
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
    assert.equal(
      click(link("/item/2", (a) => (a.rel = "nofollow external"))),
      false,
    );
    assert.equal(click(link("https://other.example/item/2")), false);
    await flush();
    assert.equal(fetchCalls.length, 0);
  });

  it("matches rel=external as a token, not a substring", async () => {
    fetchImpl = async (href) => patchResponse(["fill"], href);
    assert.equal(click(link("/item/2", (a) => (a.rel = "externals"))), true);
    await flush();
    assert.equal(fetchCalls.length, 1);
  });

  it("falls back natively when the target does not match a route", async () => {
    routeId = undefined;
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

  it("posts a urlencoded form body through the patch path", async () => {
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

  it("never resubmits a posted form once its response has settled", async () => {
    entryLoader = () => Promise.reject(new Error("stale chunk"));
    let resolveFetch!: (response: Response) => void;
    fetchImpl = () => new Promise((resolve) => (resolveFetch = resolve));
    const f = form(
      `<form action="/list" method="post"><input name="a" value="1"><button></button></form>`,
    );
    assert.equal(submit(f, f.querySelector("button")), true);
    let resubmits = 0;
    f.requestSubmit = (() => {
      resubmits++;
    }) as typeof f.requestSubmit;
    await flush();
    // The entry import already failed; the POST is in flight and must not be
    // replayed while its outcome is unknown.
    assert.equal(fetchCalls.length, 1);
    assert.equal(resubmits, 0);

    const response = new Response("", {
      headers: { "content-type": "text/html" },
    });
    Object.defineProperty(response, "url", {
      value: "http://localhost:3000/list?page=1",
    });
    Object.defineProperty(response, "redirected", { value: true });
    resolveFetch(response);
    await flush();
    // A response exists, so the mutation applied at most once server-side; a
    // native resubmission here would apply it twice. (Under tsx the DEV-only
    // warn in `fallback` throws on the absent `import.meta.env`, so only the
    // resubmission/request counts are observable, not the final assign.)
    assert.equal(resubmits, 0);
    assert.equal(fetchCalls.length, 1);
  });

  it("resubmits a posted form natively when its fetch fails pre-response", async () => {
    fetchImpl = () => Promise.reject(new TypeError("network down"));
    const f = form(
      `<form action="/list" method="post"><input name="a" value="1"><button></button></form>`,
    );
    const button = f.querySelector("button")!;
    assert.equal(submit(f, button), true);
    let resubmits = 0;
    let resubmittedWith: HTMLElement | null | undefined;
    f.requestSubmit = ((submitter?: HTMLElement | null) => {
      resubmits++;
      resubmittedWith = submitter;
    }) as typeof f.requestSubmit;
    await flush();
    assert.equal(fetchCalls.length, 1);
    assert.equal(resubmits, 1);
    assert.equal(resubmittedWith, button);
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

import assert from "assert";
import { JSDOM } from "jsdom";

// The router runs against a jsdom document with the page's globals faked:
// `fetch` answers from a script of responses, `location` and `history`
// record what the browser would have done, and `scrollTo` moves `scrollY`
// no further than the page's height allows.
describe("patch router", () => {
  const PATCH = "text/marko-patch";
  let dom: JSDOM;
  let requests: Request[];
  let responses: (() => Response | Promise<Response>)[];
  let applied: string[];
  let applyResult: boolean | Promise<boolean>;
  let onApply: ((frame: string) => void) | undefined;
  let maxScroll: number;
  let calls: string[];
  let entries: { url: string; state: unknown }[];
  let index: number;
  let loc: URL;
  let router: (
    page: () => readonly [
      Record<string, string>,
      (frame: string) => boolean | Promise<boolean>,
    ],
    pages: RegExp,
    build: string,
    preloads?: [RegExp, (() => Promise<unknown>)[], number?][],
    styles?: [string[], number[][]],
  ) => void;
  // The build's stylesheets, when a suite's `before` names them.
  let styles: [string[], number[][]] | undefined;

  const patchResponse = (
    frames: string[],
    { end = true, url = "", page = "" } = {},
  ) =>
    new Response(frames.map((f) => f + "\n").join("") + (end ? "//\n" : ""), {
      headers: {
        "content-type": "text/javascript;charset=UTF-8",
        "x-marko-patch": "b1",
        ...(page && { "x-marko-page": page }),
      },
      ...(url && { url }),
    });
  const withUrl = (response: Response, url: string) =>
    Object.defineProperty(response, "url", { value: url });
  const page = () =>
    [
      {},
      (frame: string) => {
        applied.push(frame);
        calls.push(`apply ${frame}`);
        onApply?.(frame);
        return applyResult;
      },
    ] as const;
  const tick = () => new Promise((r) => setTimeout(r, 5));
  // A history traversal: the entry changes, then `popstate` fires.
  const traverse = (delta: number) => {
    index += delta;
    loc.href = entries[index].url;
    dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    return tick();
  };
  // The browser's own fragment navigation: a new entry with no state.
  const fragment = (hash: string) => {
    entries.splice(++index, Infinity, {
      url: new URL(hash, loc.href).href,
      state: null,
    });
    return traverse(0);
  };
  const scrollBy = (y: number) => ((globalThis as any).scrollY = y);
  const click = (selector: string, init: MouseEventInit = {}) => {
    const el = dom.window.document.querySelector(selector)!;
    el.dispatchEvent(
      new dom.window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
    return tick();
  };
  const submit = (selector: string, submitter?: string) => {
    const form = dom.window.document.querySelector(selector) as HTMLFormElement;
    form.requestSubmit(
      submitter ? (form.querySelector(submitter) as HTMLElement) : undefined,
    );
    return tick();
  };

  const globals = [
    "document",
    "FormData",
    "addEventListener",
    "scrollX",
    "scrollY",
    "scrollTo",
    "location",
    "history",
    "sessionStorage",
    "fetch",
  ];
  const saved: Record<string, unknown> = {};

  afterEach(() => {
    dom.window.close();
    for (const name of globals) {
      if (name in saved) (globalThis as any)[name] = saved[name];
      else delete (globalThis as any)[name];
    }
  });

  beforeEach(async () => {
    for (const name of globals) {
      if (name in globalThis) saved[name] = (globalThis as any)[name];
    }
    dom = new JSDOM(
      `<a id=page href="/search">s</a>
       <a id=self href="/cart?x=1">c</a>
       <a id=item href="/item/3#reviews">i</a>
       <a id=api href="/api/x">a</a>
       <a id=ext href="https://other.example/search">e</a>
       <a id=rel rel="nofollow external" href="/search">r</a>
       <a id=hash href="#top">h</a>
       <a id=blank target=_blank href="/search">b</a>
       <form id=get action="/search"><input name=q value=a><button id=go>go</button></form>
       <form id=post method=post action="/cart"><input name=id value=1><button>add</button></form>
       <form id=plain method=post enctype="text/plain" action="/cart"><button>p</button></form>
       <h2 id=reviews>reviews</h2>`,
      { url: "http://app.example/cart?x=1" },
    );
    requests = [];
    responses = [];
    applied = [];
    applyResult = true;
    calls = [];
    const g = globalThis as any;
    g.document = dom.window.document;
    g.FormData = dom.window.FormData;
    g.addEventListener = dom.window.addEventListener.bind(dom.window);
    g.sessionStorage = dom.window.sessionStorage;
    g.scrollX = 0;
    g.scrollY = 40;
    maxScroll = Infinity;
    onApply = undefined;
    g.scrollTo = (x: number, y: number) => {
      calls.push(`scrollTo ${x},${y}`);
      g.scrollY = Math.min(y, maxScroll);
    };
    dom.window.Element.prototype.scrollIntoView = function () {
      calls.push(`scrollIntoView #${this.id}`);
    };
    loc = new URL(dom.window.location.href);
    entries = [{ url: loc.href, state: null }];
    index = 0;
    g.location = {
      get href() {
        return loc.href;
      },
      get origin() {
        return loc.origin;
      },
      get pathname() {
        return loc.pathname;
      },
      get search() {
        return loc.search;
      },
      get hash() {
        return loc.hash;
      },
      assign: (url: string) => calls.push(`assign ${url}`),
      replace: (url: string) => calls.push(`replace ${url}`),
      reload: () => calls.push("reload"),
    };
    g.history = {
      get state() {
        return structuredClone(entries[index].state);
      },
      scrollRestoration: "auto",
      pushState(state: unknown, _: string, url: string) {
        calls.push(`push ${url}`);
        loc.href = new URL(url, loc.href).href;
        entries.splice(++index, Infinity, {
          url: loc.href,
          state: structuredClone(state),
        });
      },
      replaceState(state: unknown, _: string, url?: string) {
        if (url) {
          calls.push(`replace-state ${url}`);
          loc.href = new URL(url, loc.href).href;
        }
        entries[index] = { url: loc.href, state: structuredClone(state) };
      },
    };
    g.fetch = async (request: Request) => {
      requests.push(request);
      const next = responses.shift();
      if (!next) throw new TypeError("network");
      return next();
    };
    ({ router } = await import(`../patch.ts?${Math.random()}`));
    router(
      page,
      /^(?:\/cart|\/search|\/item\/[^/]+)$/,
      "b1",
      [
        [
          /^\/item\/[^/]+$/,
          [() => (calls.push("preload item"), Promise.resolve())],
          1,
        ],
      ],
      styles,
    );
  });

  it("patches a page link, pushing history on the first frame only", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{a:1}", "{b:2}"]), "http://app.example/search"),
    );
    await click("#page");
    assert.equal(requests[0].headers.get("accept"), PATCH);
    assert.deepEqual(applied, ["{a:1}", "{b:2}"]);
    assert.deepEqual(calls, [
      "push http://app.example/search",
      "apply {a:1}",
      "scrollTo 0,0",
      "apply {b:2}",
    ]);
  });

  it("leaves the browser its own links", async () => {
    await click("#api");
    await click("#ext");
    await click("#rel");
    await click("#hash");
    await click("#blank");
    await click("#page", { ctrlKey: true });
    assert.equal(requests.length, 0);
    assert.deepEqual(calls, []);
  });

  it("loads the document when the answer is not a patch", async () => {
    responses.push(() =>
      withUrl(
        new Response("<html>", { headers: { "content-type": "text/html" } }),
        "http://app.example/login",
      ),
    );
    await click("#page");
    assert.deepEqual(calls, ["assign http://app.example/login"]);
  });

  it("names its build and loads the document when another build answers", async () => {
    responses.push(() =>
      withUrl(
        new Response("{a:1}\n//\n", {
          headers: {
            "content-type": "text/javascript;charset=UTF-8",
            "x-marko-patch": "b2",
          },
        }),
        "http://app.example/search",
      ),
    );
    await click("#page");
    // The build leads; the page's token (none yet) follows the separator.
    assert.equal(requests[0].headers.get("x-marko-patch"), "b1;");
    assert.deepEqual(applied, []);
    assert.deepEqual(calls, ["assign http://app.example/search"]);
  });

  it("loads the document for an error page that kept a patch's headers", async () => {
    responses.push(() =>
      withUrl(
        new Response("<!DOCTYPE html>\n<h1>Internal Server Error</h1>\n", {
          status: 500,
          headers: { "content-type": "text/html", "x-marko-patch": "b1" },
        }),
        "http://app.example/search",
      ),
    );
    await click("#page");
    assert.deepEqual(applied, []);
    assert.deepEqual(calls, ["assign http://app.example/search"]);
  });

  it("applies an error page the server answered as a patch", async () => {
    responses.push(() =>
      withUrl(
        new Response("{}\n//\n", {
          status: 404,
          headers: {
            "content-type": "text/javascript;charset=UTF-8",
            "x-marko-patch": "b1",
          },
        }),
        "http://app.example/search",
      ),
    );
    await click("#page");
    assert.deepEqual(calls, [
      "push http://app.example/search",
      "apply {}",
      "scrollTo 0,0",
    ]);
  });

  it("loads the document when a read never answers", async () => {
    await click("#page");
    assert.deepEqual(calls, ["assign http://app.example/search"]);
  });

  it("carries the fragment and scrolls to it once the frames applied", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/item/3"),
    );
    await click("#item");
    assert.deepEqual(calls, [
      "preload item",
      "push http://app.example/item/3#reviews",
      "apply {}",
      "scrollIntoView #reviews",
    ]);
  });

  it("scrolls to the fragment only once a deferred frame has applied", async () => {
    let settle!: (ok: boolean) => void;
    applyResult = new Promise<boolean>((resolve) => (settle = resolve));
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/item/3"),
    );
    await click("#item");
    assert.deepEqual(calls, [
      "preload item",
      "push http://app.example/item/3#reviews",
      "apply {}",
    ]);
    settle(true);
    await tick();
    assert.deepEqual(calls, [
      "preload item",
      "push http://app.example/item/3#reviews",
      "apply {}",
      "scrollIntoView #reviews",
    ]);
  });

  it("counts a frame after a deferred one as applied once that one has", async () => {
    let settle!: (ok: boolean) => void;
    const deferred = new Promise<boolean>((resolve) => (settle = resolve));
    onApply = (frame) => (applyResult = frame === "{a}" ? deferred : true);
    responses.push(() =>
      withUrl(patchResponse(["{a}", "{b}"]), "http://app.example/search"),
    );
    await click("#page");
    assert.deepEqual(calls.slice(1), ["apply {a}", "apply {b}"]);
    settle(true);
    await tick();
    assert.deepEqual(calls.slice(1), [
      "apply {a}",
      "apply {b}",
      "scrollTo 0,0",
    ]);
  });

  it("replaces the document when a later frame fails after the commit", async () => {
    applyResult = false;
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    assert.deepEqual(calls, [
      "push http://app.example/search",
      "apply {}",
      "replace http://app.example/search",
    ]);
  });

  it("treats a stream cut before its closing frame as no patch", async () => {
    responses.push(() =>
      withUrl(
        patchResponse(["{}"], { end: false }),
        "http://app.example/search",
      ),
    );
    await click("#page");
    assert.deepEqual(calls.at(-1), "replace http://app.example/search");
  });

  it("records no entry for a navigation superseded before its first frame", async () => {
    let release!: () => void;
    responses.push(
      () =>
        new Promise<Response>(
          (r) =>
            (release = () =>
              r(withUrl(patchResponse(["{}"]), "http://app.example/search"))),
        ),
    );
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/item/3"),
    );
    await click("#page");
    await click("#item");
    release();
    await tick();
    assert.deepEqual(applied, ["{}"]);
    assert.deepEqual(calls, [
      "preload item",
      "push http://app.example/item/3#reviews",
      "apply {}",
      "scrollIntoView #reviews",
    ]);
  });

  it("replaces the entry for a link or GET form to the URL shown", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/cart?x=1"),
    );
    await click("#self");
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search?q=a"),
    );
    await submit("#get", "#go");
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search?q=a"),
    );
    await submit("#get", "#go");
    assert.deepEqual(calls, [
      "replace-state http://app.example/cart?x=1",
      "apply {}",
      "scrollTo 0,0",
      "push http://app.example/search?q=a",
      "apply {}",
      "scrollTo 0,0",
      "replace-state http://app.example/search?q=a",
      "apply {}",
      "scrollTo 0,0",
    ]);
    assert.equal(entries.length, 2);
  });

  it("submits a GET form as a page query", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search?q=a"),
    );
    await submit("#get", "#go");
    assert.equal(requests[0].url, "http://app.example/search?q=a");
    assert.equal(requests[0].method, "GET");
  });

  it("posts a form without aborting it when superseded", async () => {
    let release!: () => void;
    responses.push(
      () =>
        new Promise<Response>(
          (r) =>
            (release = () =>
              r(withUrl(patchResponse(["{}"]), "http://app.example/cart"))),
        ),
    );
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await submit("#post");
    assert.equal(requests[0].method, "POST");
    assert.equal(await requests[0].text(), "id=1");
    await click("#page");
    assert.equal(requests[0].signal.aborted, false);
    release();
    await tick();
    assert.deepEqual(calls, [
      "push http://app.example/search",
      "apply {}",
      "scrollTo 0,0",
    ]);
  });

  it("sends a double-clicked submission once", async () => {
    let release!: () => void;
    responses.push(
      () =>
        new Promise<Response>(
          (r) =>
            (release = () =>
              r(withUrl(patchResponse(["{}"]), "http://app.example/cart"))),
        ),
    );
    await submit("#post");
    await submit("#post");
    assert.equal(requests.length, 1);
    release();
    await tick();
    assert.deepEqual(applied, ["{}"]);
    // Once its response shows, the same submission is a new one.
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/cart"),
    );
    await submit("#post");
    assert.equal(requests.length, 2);
  });

  it("sends a changed submission, superseding the one in flight", async () => {
    let release!: () => void;
    responses.push(
      () =>
        new Promise<Response>(
          (r) =>
            (release = () =>
              r(withUrl(patchResponse(["{1}"]), "http://app.example/cart"))),
        ),
    );
    responses.push(() =>
      withUrl(patchResponse(["{2}"]), "http://app.example/cart"),
    );
    await submit("#post");
    dom.window.document.querySelector<HTMLInputElement>("#post input")!.value =
      "2";
    await submit("#post");
    release();
    await tick();
    assert.deepEqual(
      await Promise.all(requests.map((request) => request.text())),
      ["id=1", "id=2"],
    );
    assert.deepEqual(applied, ["{2}"]);
  });

  it("resubmits a form natively when its request never answers", async () => {
    // After the router's own listener, so an intercepted submit reads as such.
    let native = 0;
    dom.window.document.addEventListener("submit", (ev) => {
      if (!ev.defaultPrevented) native++;
    });
    await submit("#post");
    assert.equal(native, 1);
    assert.deepEqual(calls, []);
  });

  it("lets a text/plain form submit natively", async () => {
    await submit("#plain");
    assert.equal(requests.length, 0);
  });

  it("restores a traversed entry once its content applies, both ways", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    scrollBy(2500);
    responses.push(() =>
      withUrl(patchResponse(["{back}"]), "http://app.example/cart?x=1"),
    );
    await traverse(-1);
    assert.equal(requests[1].url, "http://app.example/cart?x=1");
    responses.push(() =>
      withUrl(patchResponse(["{forward}"]), "http://app.example/search"),
    );
    await traverse(1);
    assert.deepEqual(calls, [
      "push http://app.example/search",
      "apply {}",
      "scrollTo 0,0",
      "apply {back}",
      "scrollTo 0,40",
      "apply {forward}",
      "scrollTo 0,2500",
    ]);
  });

  it("keeps restoring as frames grow the page, until it lands", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    maxScroll = 10;
    onApply = (frame) => frame === "{more}" && (maxScroll = 100);
    responses.push(() =>
      withUrl(
        patchResponse(["{short}", "{more}", "{last}"]),
        "http://app.example/cart?x=1",
      ),
    );
    await traverse(-1);
    assert.deepEqual(calls.slice(3), [
      "apply {short}",
      "scrollTo 0,40",
      "apply {more}",
      "scrollTo 0,40",
      "apply {last}",
    ]);
  });

  it("stops restoring once the user scrolls", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    maxScroll = 10;
    onApply = (frame) => frame === "{more}" && ((maxScroll = 100), scrollBy(5));
    responses.push(() =>
      withUrl(
        patchResponse(["{short}", "{more}"]),
        "http://app.example/cart?x=1",
      ),
    );
    await traverse(-1);
    assert.deepEqual(calls.slice(3), [
      "apply {short}",
      "scrollTo 0,40",
      "apply {more}",
    ]);
  });

  it("holds scroll anchoring off until a restore lands", async () => {
    const { style } = dom.window.document.documentElement;
    scrollBy(800);
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    maxScroll = 300;
    // Content growing above the viewport moves it, as scroll anchoring does.
    onApply = (frame) => {
      calls.push(`anchor ${style.overflowAnchor || "auto"}`);
      if (frame === "{grow}") {
        maxScroll = 1000;
        if (style.overflowAnchor !== "none") scrollBy(scrollY + 400);
      }
    };
    responses.push(() =>
      withUrl(
        patchResponse(["{short}", "{grow}", "{last}"]),
        "http://app.example/cart?x=1",
      ),
    );
    await traverse(-1);
    assert.deepEqual(calls.slice(3), [
      "apply {short}",
      "anchor auto",
      "scrollTo 0,800",
      "apply {grow}",
      "anchor none",
      "scrollTo 0,800",
      "apply {last}",
      "anchor auto",
    ]);
    assert.equal(scrollY, 800);
  });

  it("gives scroll anchoring back once the frames end short of a restore", async () => {
    const { style } = dom.window.document.documentElement;
    style.overflowAnchor = "auto";
    scrollBy(800);
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    maxScroll = 300;
    onApply = () => calls.push(`anchor ${style.overflowAnchor}`);
    responses.push(() =>
      withUrl(patchResponse(["{a}", "{b}"]), "http://app.example/cart?x=1"),
    );
    await traverse(-1);
    assert.deepEqual(calls.slice(3), [
      "apply {a}",
      "anchor auto",
      "scrollTo 0,800",
      "apply {b}",
      "anchor none",
      "scrollTo 0,800",
    ]);
    assert.equal(style.overflowAnchor, "auto");
  });

  it("restores a fragment entry of the page without a request", async () => {
    await fragment("#reviews");
    // The browser scrolls to a new fragment itself.
    assert.deepEqual(calls, []);
    scrollBy(900);
    await traverse(-1);
    await traverse(1);
    assert.equal(requests.length, 0);
    assert.deepEqual(calls, ["scrollTo 0,40", "scrollTo 0,900"]);
  });

  it("abandons a traversal once history returns to the page shown", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    let release!: () => void;
    responses.push(
      () =>
        new Promise<Response>(
          (r) =>
            (release = () =>
              r(withUrl(patchResponse(["{}"]), "http://app.example/cart?x=1"))),
        ),
    );
    await traverse(-1);
    await traverse(1);
    release();
    await tick();
    assert.equal(applied.length, 1);
    assert.equal(loc.href, "http://app.example/search");
  });

  it("reloads a traversed entry that does not answer with a patch", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    responses.push(() =>
      withUrl(
        new Response("<html>", { headers: { "content-type": "text/html" } }),
        "http://app.example/cart?x=1",
      ),
    );
    await traverse(-1);
    assert.equal(calls.at(-1), "reload");
    assert.equal(entries.length, 2);
  });

  it("holds scroll anchoring off for a reload's restore until the page loads", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    scrollBy(700);
    dom.window.dispatchEvent(new dom.window.Event("pagehide"));
    // The reload: the same entry, a new document still streaming in.
    calls = [];
    scrollBy(0);
    maxScroll = 300;
    ({ router } = await import(`../patch.ts?${Math.random()}`));
    router(page, /^\/search$/, "b1");
    const { style } = dom.window.document.documentElement;
    assert.equal(style.overflowAnchor, "none");
    maxScroll = 1000;
    dom.window.dispatchEvent(new dom.window.Event("load"));
    assert.deepEqual(calls, ["scrollTo 0,700", "scrollTo 0,700"]);
    assert.equal(scrollY, 700);
    assert.equal(style.overflowAnchor, "");
  });

  describe("with a build's stylesheets", () => {
    before(
      () =>
        (styles = [
          ["/a.css", "/b.css", "/c.css"],
          [[0], [1, 2]],
        ]),
    );
    after(() => (styles = undefined));
    const head = () =>
      [...dom.window.document.querySelectorAll("link")].map(
        (link) =>
          new URL(link.href).pathname + (link.media ? ` ${link.media}` : ""),
      );
    const loadSheets = () => {
      for (const link of dom.window.document.querySelectorAll("link")) {
        link.dispatchEvent(new dom.window.Event("load"));
      }
      return tick();
    };

    it("links a page's stylesheets inert and swaps them in with its content", async () => {
      dom.window.document.head.innerHTML = `<link rel=stylesheet href=/app.css><link rel=stylesheet href=/a.css><link rel=stylesheet href=/c.css><link rel=stylesheet href=https://fonts.example/f.css>`;
      onApply = () => calls.push(`sheets ${head().join(", ")}`);
      responses.push(() =>
        withUrl(
          patchResponse(["{}", "{more}"], { page: "1" }),
          "http://app.example/item/3",
        ),
      );
      await click("#item");
      // The first frame waits on the stylesheet the page lacks.
      assert.deepEqual(applied, []);
      assert.deepEqual(head(), [
        "/app.css",
        "/a.css",
        "/b.css not all",
        "/c.css",
        "/f.css",
      ]);
      await loadSheets();
      assert.deepEqual(calls.slice(1, 4), [
        "push http://app.example/item/3#reviews",
        "apply {}",
        "sheets /app.css, /a.css, /b.css not all, /c.css, /f.css",
      ]);
      assert.deepEqual(head(), ["/app.css", "/b.css", "/c.css", "/f.css"]);
    });

    it("swaps in the stylesheets of the page the server rendered", async () => {
      dom.window.document.head.innerHTML = `<link rel=stylesheet href=/c.css>`;
      responses.push(() =>
        withUrl(
          patchResponse(["{}"], { page: "0" }),
          "http://app.example/item/3",
        ),
      );
      await click("#item");
      assert.deepEqual(head(), ["/b.css not all", "/c.css", "/a.css not all"]);
      await loadSheets();
      assert.deepEqual(head(), ["/a.css"]);
    });

    it("swaps them in once a frame a module load defers has applied", async () => {
      dom.window.document.head.innerHTML = `<link rel=stylesheet href=/a.css>`;
      let settle!: (ok: boolean) => void;
      applyResult = new Promise<boolean>((resolve) => (settle = resolve));
      responses.push(() =>
        withUrl(
          patchResponse(["{}"], { page: "1" }),
          "http://app.example/item/3",
        ),
      );
      await click("#item");
      await loadSheets();
      assert.deepEqual(applied, ["{}"]);
      assert.deepEqual(head(), ["/a.css", "/b.css not all", "/c.css not all"]);
      settle(true);
      await tick();
      assert.deepEqual(head(), ["/b.css", "/c.css"]);
    });

    it("leaves the stylesheets as they are for a page the build does not name", async () => {
      dom.window.document.head.innerHTML = `<link rel=stylesheet href=/a.css>`;
      responses.push(() =>
        withUrl(patchResponse(["{}"]), "http://app.example/search"),
      );
      await click("#page");
      assert.deepEqual(applied, ["{}"]);
      assert.deepEqual(head(), ["/a.css"]);
    });
  });

  it("returns a reloaded entry to where it was", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    scrollBy(700);
    dom.window.dispatchEvent(new dom.window.Event("pagehide"));
    // The reload: the same entry, a new document.
    calls = [];
    scrollBy(0);
    ({ router } = await import(`../patch.ts?${Math.random()}`));
    router(page, /^\/search$/, "b1");
    assert.deepEqual(calls, ["scrollTo 0,700"]);
  });
});

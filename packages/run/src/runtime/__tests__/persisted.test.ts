import assert from "assert";
import { JSDOM } from "jsdom";

// The router runs against a jsdom document with the page's globals faked:
// `fetch` answers from a script of responses, `location` and `history`
// record what the browser would have done.
describe("persisted router", () => {
  const PATCH = "text/marko-patch";
  let dom: JSDOM;
  let requests: Request[];
  let responses: (() => Response | Promise<Response>)[];
  let applied: string[];
  let applyResult: boolean | Promise<boolean>;
  let calls: string[];
  let router: (
    page: () => readonly [
      Record<string, string>,
      (frame: string) => boolean | Promise<boolean>,
    ],
    pages: RegExp,
  ) => void;

  const patchResponse = (frames: string[], { end = true, url = "" } = {}) =>
    new Response(frames.map((f) => f + "\n").join("") + (end ? "//\n" : ""), {
      headers: {
        "content-type": "text/javascript;charset=UTF-8",
        "x-marko-patch": "1",
      },
      ...(url && { url }),
    });
  const withUrl = (response: Response, url: string) =>
    Object.defineProperty(response, "url", { value: url });
  const page = () =>
    [{}, (frame: string) => (applied.push(frame), applyResult)] as const;
  const tick = () => new Promise((r) => setTimeout(r, 5));
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
    g.scrollX = 0;
    g.scrollY = 40;
    g.scrollTo = (x: number, y: number) => calls.push(`scrollTo ${x},${y}`);
    dom.window.Element.prototype.scrollIntoView = function () {
      calls.push(`scrollIntoView #${this.id}`);
    };
    const loc = new URL(dom.window.location.href);
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
      state: null as unknown,
      scrollRestoration: "auto",
      pushState(state: unknown, _: string, url: string) {
        this.state = state;
        calls.push(`push ${url}`);
        loc.href = new URL(url, loc.href).href;
      },
      replaceState(state: unknown, _: string, url?: string) {
        this.state = state;
        if (url) {
          calls.push(`replace-state ${url}`);
          loc.href = new URL(url, loc.href).href;
        }
      },
    };
    g.fetch = async (request: Request) => {
      requests.push(request);
      const next = responses.shift();
      if (!next) throw new TypeError("network");
      return next();
    };
    ({ router } = await import(`../persisted.ts?${Math.random()}`));
    router(page, /^(?:\/cart|\/search|\/item\/[^/]+)$/);
  });

  it("patches a page link, pushing history on the first frame only", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{a:1}", "{b:2}"]), "http://app.example/search"),
    );
    await click("#page");
    assert.equal(requests[0].headers.get("accept"), PATCH);
    assert.deepEqual(applied, ["{a:1}", "{b:2}"]);
    assert.deepEqual(calls, ["push http://app.example/search", "scrollTo 0,0"]);
    assert.deepEqual(dom.window.history.state, null);
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
      "push http://app.example/item/3#reviews",
      "scrollIntoView #reviews",
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
      "scrollTo 0,0",
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
      "push http://app.example/item/3#reviews",
      "scrollIntoView #reviews",
    ]);
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
    assert.deepEqual(calls, ["push http://app.example/search", "scrollTo 0,0"]);
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

  it("restores a traversed entry's scroll position", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/cart?x=1"),
    );
    (globalThis as any).history.state = { s: [0, 40] };
    (globalThis as any).location.href;
    const loc = new URL("http://app.example/cart?x=1");
    Object.defineProperty(globalThis, "location", {
      value: {
        ...(globalThis as any).location,
        href: loc.href,
        pathname: loc.pathname,
        search: loc.search,
        origin: loc.origin,
        hash: "",
      },
      configurable: true,
    });
    dom.window.dispatchEvent(new dom.window.Event("popstate"));
    await tick();
    assert.equal(requests[1].url, "http://app.example/cart?x=1");
    assert.deepEqual(calls.at(-1), "scrollTo 0,40");
  });
});

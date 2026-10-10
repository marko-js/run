import assert from "assert";
import { JSDOM } from "jsdom";

// The router runs against a jsdom document with the page's globals faked:
// `fetch` answers from a script of responses, `location` and `history`
// record what the browser would have done, and `scrollTo` moves `scrollY`
// no further than the page's height allows.
describe("patch router", () => {
  let dom: JSDOM;
  let requests: Request[];
  // The signal each request was fetched with.
  let signals: (AbortSignal | undefined)[];
  let responses: (() => Response | Promise<Response>)[];
  let applied: string[];
  let applyResult: boolean | Promise<boolean>;
  let onApply: ((frame: string) => void) | undefined;
  let held: Promise<unknown> | undefined;
  let maxScroll: number;
  let calls: string[];
  let entries: { url: string; state: unknown }[];
  let index: number;
  let loc: URL;
  let router: (page: typeof patch, pages: RegExp, handlers?: RegExp) => void;
  // The live response's stop: the next `patch()` calls it.
  let current: (() => void) | undefined;
  // Each `patch()` call's `replay`.
  let replays: (1 | undefined)[];

  const encoder = new TextEncoder();
  const markers = {
    "content-type": "text/javascript;charset=UTF-8",
    "x-marko-patch": "1",
  };
  // Each frame a chunk of its own, as a server flushes them.
  const patchResponse = (frames: string[]) =>
    new Response(
      new ReadableStream({
        pull(controller) {
          const frame = frames.shift();
          if (frame === undefined) controller.close();
          else controller.enqueue(encoder.encode(frame + "\n"));
        },
      }),
      { headers: markers },
    );
  const withUrl = (response: Response, url: string): Response =>
    Object.defineProperties(response, {
      url: { value: url },
      // A fetched response's clone keeps its URL.
      clone: {
        value: () => withUrl(Response.prototype.clone.call(response), url),
      },
    });
  // A patch response whose frames the test sends, each a chunk of its own.
  const streamResponse = (url: string) => {
    let body!: ReadableStreamDefaultController<Uint8Array>;
    const response = withUrl(
      new Response(new ReadableStream({ start: (c) => (body = c) }), {
        headers: markers,
      }),
      url,
    );
    return {
      response,
      send: (frame: string) => body.enqueue(encoder.encode(frame + "\n")),
      end: () => body.close(),
    };
  };
  // Marko's side, as `patch($global)` gives it: it reads the body's lines as
  // frames, commits once right before the first changes the page and reports
  // each chunk's frames once applied. A frame applies once `held` settles,
  // with `applyResult`'s outcome.
  const patch = (signal: AbortSignal, replay?: unknown) => {
    // Marko only reads whether it is a replay.
    replays.push(replay ? 1 : undefined);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    // The signal, a failure or the next `patch()` stops the response at once,
    // with no callbacks.
    const stop = () => {
      if (current === stop) {
        current = undefined;
        reader?.cancel().catch(() => {});
      }
    };
    current?.();
    current = stop;
    signal.addEventListener("abort", stop);
    const live = () => current === stop;
    const apply = async (
      res: Response,
      onCommit: () => void,
      onApplied: () => void,
      onEnd: () => void,
      onFail: () => void,
    ) => {
      let committed = false;
      let ended = false;
      let waiting = 0;
      const fail = () => {
        if (live()) {
          stop();
          onFail();
        }
      };
      const done = (ok: boolean) =>
        ok ? live() && (--waiting || (onApplied(), ended && onEnd())) : fail();
      const applyFrame = (frame: string) => {
        if (!committed) {
          committed = true;
          onCommit();
        }
        applied.push(frame);
        calls.push(`apply ${frame}`);
        onApply?.(frame);
        const result = applyResult;
        if (typeof result === "object") result.then(done);
        else done(result);
      };
      if (!live() || !res.headers.has("x-marko-patch")) {
        res.body?.cancel();
        return fail();
      }
      reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      try {
        for (let read; !(read = await reader.read()).done;) {
          const lines = (
            buffered + decoder.decode(read.value, { stream: true })
          ).split("\n");
          buffered = lines.pop()!;
          waiting++;
          for (const frame of lines) {
            if (!live()) break;
            waiting++;
            if (held) held.then(() => live() && applyFrame(frame));
            else applyFrame(frame);
          }
          if (lines.length) done(true);
          else waiting--;
        }
      } catch {
        return fail();
      }
      if (live()) {
        ended = true;
        if (buffered) fail();
        else if (!waiting) onEnd();
      }
    };
    return [{ "x-marko-patch": "b1;" }, apply] as const;
  };
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
       <a id=to-later href="/item/3#later">l</a>
       <a id=to-text href="/item/3#:~:text=reviews">t</a>
       <a id=api href="/api/x">a</a>
       <a id=docs href="/docs">d</a>
       <a id=ext href="https://other.example/search">e</a>
       <a id=rel rel="nofollow external" href="/search">r</a>
       <a id=hash href="#top">h</a>
       <a id=blank target=_blank href="/search">b</a>
       <form id=get action="/search"><input name=q value=a><button id=go>go</button></form>
       <form id=post method=post action="/cart"><input name=id value=1><button>add</button></form>
       <form id=docs-get action="/docs"><input name=v value=1><button>d</button></form>
       <form id=docs-post method=post action="/docs"><button>d</button></form>
       <h2 id=reviews>reviews</h2>`,
      { url: "http://app.example/cart?x=1" },
    );
    // jsdom rejects a null submitter, which the spec and browsers accept.
    const { prototype } = dom.window.HTMLFormElement;
    const { requestSubmit } = prototype;
    prototype.requestSubmit = function (submitter) {
      requestSubmit.call(this, submitter ?? undefined);
    };
    requests = [];
    signals = [];
    responses = [];
    replays = [];
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
    held = undefined;
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
      replace(url: string) {
        calls.push(`replace ${url}`);
        const next = new URL(url, loc.href);
        // A fragment of the shown document navigates within it: the entry is
        // replaced with no state and `popstate` fires at once.
        if (
          next.hash &&
          next.pathname + next.search === loc.pathname + loc.search
        ) {
          loc.href = next.href;
          entries[index] = { url: loc.href, state: null };
          dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
        }
      },
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
    g.fetch = async (input: string, init?: RequestInit) => {
      requests.push(new Request(input, init));
      signals.push(init?.signal || undefined);
      const next = responses.shift();
      if (!next) throw new TypeError("network");
      return next();
    };
    ({ router } = await import(`../patch.ts?${Math.random()}`));
    router(patch, /^(?:\/cart|\/search|\/item\/[^/]+)$/, /^\/docs$/);
  });

  it("patches a page link, pushing history on the first frame only", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{a:1}", "{b:2}"]), "http://app.example/search"),
    );
    await click("#page");
    // Marko's headers, as it gave them; nothing else asks for a patch.
    assert.equal(requests[0].headers.get("x-marko-patch"), "b1;");
    assert.equal(requests[0].headers.get("accept"), null);
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

  it("loads the document when the server refuses a read of a stale build", async () => {
    responses.push(() =>
      withUrl(new Response(null, { status: 412 }), "http://app.example/search"),
    );
    await click("#page");
    assert.deepEqual(applied, []);
    assert.deepEqual(calls, ["assign http://app.example/search"]);
  });

  it("applies an error page the server answered as a patch", async () => {
    responses.push(() =>
      withUrl(
        new Response("{}\n", {
          status: 404,
          headers: {
            "content-type": "text/javascript;charset=UTF-8",
            "x-marko-patch": "1",
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
      "push http://app.example/item/3#reviews",
      "apply {}",
      "replace #reviews",
    ]);
  });

  it("hands the fragment to the browser once content applies, keeping its entry", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/item/3"),
    );
    await click("#item");
    assert.equal(calls.at(-1), "replace #reviews");
    // The browser's fragment navigation left one entry, still the router's.
    assert.equal(entries.length, 2);
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/cart?x=1"),
    );
    await traverse(-1);
    await traverse(1);
    // Forward replays the entry's kept response: no request for it.
    assert.equal(requests.length, 2);
    assert.deepEqual(applied, ["{}", "{}", "{}"]);
  });

  it("hands a fragment to the browser once its target arrives, before the end", async () => {
    const { document } = dom.window;
    onApply = (frame) =>
      frame === "{b}" &&
      document.body.insertAdjacentHTML("beforeend", "<p id=later>later</p>");
    const stream = streamResponse("http://app.example/item/3");
    responses.push(() => stream.response);
    await click("#to-later");
    stream.send("{a}");
    await tick();
    assert.equal(calls.includes("replace #later"), false);
    stream.send("{b}");
    await tick();
    assert.equal(calls.at(-1), "replace #later");
    stream.send("{c}");
    stream.end();
    await tick();
    // Once per navigation.
    assert.equal(calls.filter((call) => call === "replace #later").length, 1);
  });

  it("hands a fragment with no element target to the browser once content ends", async () => {
    const stream = streamResponse("http://app.example/item/3");
    responses.push(() => stream.response);
    await click("#to-text");
    stream.send("{a}");
    await tick();
    assert.equal(calls.at(-1), "scrollTo 0,0");
    stream.end();
    await tick();
    assert.equal(calls.at(-1), "replace #:~:text=reviews");
  });

  it("leaves a text fragment to the user who scrolled before the end", async () => {
    const stream = streamResponse("http://app.example/item/3");
    responses.push(() => stream.response);
    await click("#to-text");
    stream.send("{a}");
    await tick();
    scrollBy(500);
    stream.end();
    await tick();
    assert.equal(calls.at(-1), "scrollTo 0,0");
  });

  it("leaves the fragment to the user who scrolled", async () => {
    const { document } = dom.window;
    onApply = (frame) =>
      frame === "{b}" &&
      document.body.insertAdjacentHTML("beforeend", "<p id=later>later</p>");
    const stream = streamResponse("http://app.example/item/3");
    responses.push(() => stream.response);
    await click("#to-later");
    stream.send("{a}");
    await tick();
    scrollBy(700);
    stream.send("{b}");
    stream.end();
    await tick();
    assert.equal(calls.includes("replace #later"), false);
  });

  it("commits a held first frame only once it applies", async () => {
    let land!: () => void;
    held = new Promise<void>((resolve) => (land = resolve));
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    assert.deepEqual(calls, []);
    land();
    await tick();
    assert.deepEqual(calls, [
      "push http://app.example/search",
      "apply {}",
      "scrollTo 0,0",
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
      "push http://app.example/item/3#reviews",
      "apply {}",
    ]);
    settle(true);
    await tick();
    assert.deepEqual(calls, [
      "push http://app.example/item/3#reviews",
      "apply {}",
      "replace #reviews",
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

  it("treats a stream cut short as no patch", async () => {
    let sent = false;
    responses.push(() =>
      withUrl(
        new Response(
          // A frame arrives, then the connection resets.
          new ReadableStream({
            pull(controller) {
              if (sent) {
                setTimeout(() =>
                  controller.error(new Error("connection reset")),
                );
              } else controller.enqueue(new TextEncoder().encode("{}\n"));
              sent = true;
            },
          }),
          {
            headers: {
              "content-type": "text/javascript;charset=UTF-8",
              "x-marko-patch": "1",
            },
          },
        ),
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
      "apply {}",
      "replace #reviews",
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

  it("patches a read of a handler path, landing where it redirects", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{a:1}"]), "http://app.example/search"),
    );
    await click("#docs");
    responses.push(() =>
      withUrl(patchResponse(["{b:2}"]), "http://app.example/search?v=1"),
    );
    await submit("#docs-get");
    assert.deepEqual(
      requests.map((request) => [
        request.url,
        request.headers.get("x-marko-patch"),
      ]),
      [
        ["http://app.example/docs", "b1;"],
        ["http://app.example/docs?v=1", "b1;"],
      ],
    );
    assert.deepEqual(calls, [
      "push http://app.example/search",
      "apply {a:1}",
      "scrollTo 0,0",
      "push http://app.example/search?v=1",
      "apply {b:2}",
      "scrollTo 0,0",
    ]);
  });

  it("loads the document a handler path answers without a patch", async () => {
    responses.push(() =>
      withUrl(
        new Response("{}", { headers: { "content-type": "application/json" } }),
        "http://app.example/docs",
      ),
    );
    await click("#docs");
    assert.deepEqual(calls, ["assign http://app.example/docs"]);
  });

  it("lets a form post to a handler path natively", async () => {
    await submit("#docs-post");
    assert.equal(requests.length, 0);
  });

  it("aborts a superseded mutation's request, as a browser does", async () => {
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
    assert.equal(signals[0]!.aborted, true);
    release();
    await tick();
    assert.deepEqual(calls, [
      "push http://app.example/search",
      "apply {}",
      "scrollTo 0,0",
    ]);
  });

  it("sends a mutation without keepalive, as a browser's navigation", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/cart"),
    );
    await submit("#post");
    assert.equal(requests[0].keepalive, false);
  });

  it("sends a read at once, superseding a mutation under way", async () => {
    let release!: () => void;
    responses.push(
      () =>
        new Promise<Response>(
          (r) =>
            (release = () =>
              r(withUrl(patchResponse(["{post}"]), "http://app.example/cart"))),
        ),
    );
    responses.push(() =>
      withUrl(patchResponse(["{read}"]), "http://app.example/search"),
    );
    await submit("#post");
    await click("#page");
    assert.equal(requests.length, 2);
    release();
    await tick();
    assert.deepEqual(applied, ["{read}"]);
  });

  it("sends a repeated submission again, superseding the one in flight", async () => {
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
    await submit("#post");
    assert.equal(requests.length, 2);
    release();
    await tick();
    assert.deepEqual(applied, ["{2}"]);
  });

  it("leaves the page as it is when a navigation answers 204 or 205", async () => {
    responses.push(() =>
      withUrl(new Response(null, { status: 204 }), "http://app.example/search"),
    );
    responses.push(() =>
      withUrl(new Response(null, { status: 205 }), "http://app.example/cart"),
    );
    await click("#page");
    await submit("#post");
    assert.equal(requests.length, 2);
    assert.deepEqual(calls, []);
    assert.equal(entries.length, 1);
  });

  it("starts a navigation's page with focus at the document", async () => {
    const link = dom.window.document.querySelector<HTMLElement>("#page")!;
    link.focus();
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search"),
    );
    await click("#page");
    assert.equal(dom.window.document.activeElement, dom.window.document.body);
  });

  it("focuses the page's autofocus control once, as a document load does", async () => {
    const { document } = dom.window;
    onApply = () =>
      document.body.insertAdjacentHTML("beforeend", "<input autofocus>");
    const stream = streamResponse("http://app.example/search");
    responses.push(() => stream.response);
    await click("#page");
    stream.send("{a}");
    await tick();
    const control = document.querySelector<HTMLElement>("input[autofocus]")!;
    assert.equal(document.activeElement, control);
    // Focus the user moves away stays where they put it as content streams on.
    control.blur();
    stream.send("{b}");
    stream.end();
    await tick();
    assert.equal(document.activeElement, document.body);
  });

  it("leaves focus to a fragment's target over an autofocus control", async () => {
    const { document } = dom.window;
    onApply = () =>
      document.body.insertAdjacentHTML("beforeend", "<input autofocus>");
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/item/3"),
    );
    await click("#item");
    assert.equal(document.activeElement, document.body);
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

  it("resets the submitted form as its page commits, as a document load shows it fresh", async () => {
    const input = dom.window.document.querySelector(
      "#post input",
    ) as HTMLInputElement;
    input.value = "typed";
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/cart"),
    );
    await submit("#post");
    assert.equal(input.value, "1");
  });

  it("resets a submitted GET form too", async () => {
    const input = dom.window.document.querySelector(
      "#get input",
    ) as HTMLInputElement;
    input.value = "b";
    responses.push(() =>
      withUrl(patchResponse(["{}"]), "http://app.example/search?q=b"),
    );
    await submit("#get");
    assert.equal(requests[0].url, "http://app.example/search?q=b");
    assert.equal(input.value, "a");
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

  it("resubmits a form natively when the server refuses its stale build", async () => {
    let native = 0;
    dom.window.document.addEventListener("submit", (ev) => {
      if (!ev.defaultPrevented) native++;
    });
    responses.push(() =>
      withUrl(new Response(null, { status: 412 }), "http://app.example/cart"),
    );
    await submit("#post");
    await tick();
    assert.equal(native, 1);
    assert.deepEqual(calls, []);
  });

  it("resubmits a form natively without a submitter the page removed", async () => {
    let native = 0;
    dom.window.document.addEventListener("submit", (ev) => {
      // The page swaps its button out while the request is under way.
      if (ev.defaultPrevented) ev.submitter!.remove();
      else native++;
    });
    await submit("#post", "button");
    assert.equal(native, 1);
    assert.deepEqual(calls, []);
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
    // Forward replays the entry's kept response.
    await traverse(1);
    assert.equal(requests.length, 2);
    assert.deepEqual(calls, [
      "push http://app.example/search",
      "apply {}",
      "scrollTo 0,0",
      "apply {back}",
      "scrollTo 0,40",
      "apply {}",
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

  it("streams the shown page on through a fragment traversal back to it", async () => {
    const stream = streamResponse("http://app.example/search");
    responses.push(() => stream.response);
    await click("#page");
    stream.send("{a}");
    await tick();
    await fragment("#reviews");
    await traverse(-1);
    stream.send("{b}");
    stream.end();
    await tick();
    assert.deepEqual(applied, ["{a}", "{b}"]);
    assert.equal(requests.length, 1);
  });

  it("re-syncs the shown page when back then forward cut its response", async () => {
    const stream = streamResponse("http://app.example/search");
    responses.push(() => stream.response);
    await click("#page");
    stream.send("{a}");
    await tick();
    let release!: () => void;
    responses.push(
      () =>
        new Promise<Response>(
          (r) =>
            (release = () =>
              r(
                withUrl(
                  patchResponse(["{back}"]),
                  "http://app.example/cart?x=1",
                ),
              )),
        ),
    );
    await traverse(-1);
    responses.push(() =>
      withUrl(patchResponse(["{again}"]), "http://app.example/search"),
    );
    await traverse(1);
    release();
    await tick();
    assert.deepEqual(
      requests.map((request) => request.url),
      [
        "http://app.example/search",
        "http://app.example/cart?x=1",
        "http://app.example/search",
      ],
    );
    assert.deepEqual(applied, ["{a}", "{again}"]);
    // The re-sync is a traversal: it records no entry.
    assert.deepEqual(
      calls.filter((call) => /^(push|replace)/.test(call)),
      ["push http://app.example/search"],
    );
  });

  it("replays a kept entry's response on a traversal, sending no request", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{s}"]), "http://app.example/search"),
    );
    await click("#page");
    responses.push(() =>
      withUrl(patchResponse(["{c}"]), "http://app.example/cart?x=1"),
    );
    await click("#self");
    // An ended request is never aborted: a browser errors its kept copy then.
    assert.equal(signals[0]!.aborted, false);
    await traverse(-1);
    assert.equal(requests.length, 2);
    assert.deepEqual(applied, ["{s}", "{c}", "{s}"]);
    // Marko keeps the page's newer token through a replay.
    assert.deepEqual(replays, [undefined, undefined, 1]);
  });

  it("replays the entry a mutation landed on, as a browser restores it", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{post}"]), "http://app.example/cart"),
    );
    await submit("#post");
    responses.push(() =>
      withUrl(patchResponse(["{s}"]), "http://app.example/search"),
    );
    await click("#page");
    await traverse(-1);
    assert.equal(requests.length, 2);
    assert.deepEqual(applied, ["{post}", "{s}", "{post}"]);
  });

  it("fetches a traversal to an entry it did not keep whole", async () => {
    // The document's own entry was never a response.
    responses.push(() =>
      withUrl(patchResponse(["{s}"]), "http://app.example/search"),
    );
    await click("#page");
    // A response cut by the next navigation is not kept.
    const stream = streamResponse("http://app.example/cart?x=1");
    responses.push(() => stream.response);
    await click("#self");
    stream.send("{cut}");
    await tick();
    // Nor is one that failed.
    applyResult = false;
    responses.push(() =>
      withUrl(patchResponse(["{failed}"]), "http://app.example/search"),
    );
    await click("#page");
    applyResult = true;
    for (const url of ["/cart?x=1", "/search", "/cart?x=1"]) {
      responses.push(() =>
        withUrl(patchResponse(["{again}"]), "http://app.example" + url),
      );
    }
    // To the cut entry, the failed one, then the document's.
    await traverse(-1);
    await traverse(1);
    await traverse(-3);
    assert.deepEqual(replays.slice(3), [undefined, undefined, undefined]);
    assert.equal(requests.length, 6);
  });

  it("keeps the last ten entries' responses", async () => {
    for (let i = 1; i <= 11; i++) {
      const url = i % 2 ? "/search" : "/cart?x=1";
      responses.push(() =>
        withUrl(patchResponse([`{${i}}`]), "http://app.example" + url),
      );
      await click(i % 2 ? "#page" : "#self");
    }
    await traverse(-9);
    assert.equal(requests.length, 11);
    assert.equal(applied.at(-1), "{2}");
    responses.push(() =>
      withUrl(patchResponse(["{fresh}"]), "http://app.example/search"),
    );
    await traverse(-1);
    assert.equal(requests.length, 12);
    assert.equal(applied.at(-1), "{fresh}");
  });

  it("drops the kept responses of the entries a push discards", async () => {
    for (let i = 1; i <= 10; i++) {
      const url = i % 2 ? "/search" : "/cart?x=1";
      responses.push(() =>
        withUrl(patchResponse([`{${i}}`]), "http://app.example" + url),
      );
      await click(i % 2 ? "#page" : "#self");
    }
    // Back to entry 9, then a push that discards entry 10: entry 1 stays
    // kept, as only ten are.
    await traverse(-1);
    responses.push(() =>
      withUrl(patchResponse(["{item}"]), "http://app.example/item/3"),
    );
    await click("#item");
    await traverse(-9);
    assert.equal(requests.length, 11);
    assert.equal(applied.at(-1), "{1}");
  });

  it("keeps only a replaced entry's new response", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{s}"]), "http://app.example/search"),
    );
    await click("#page");
    // The same URL again replaces the entry; its response is then cut.
    const stream = streamResponse("http://app.example/search");
    responses.push(() => stream.response);
    await click("#page");
    stream.send("{s2}");
    await tick();
    responses.push(() =>
      withUrl(patchResponse(["{c}"]), "http://app.example/cart?x=1"),
    );
    await click("#self");
    responses.push(() =>
      withUrl(patchResponse(["{fresh}"]), "http://app.example/search"),
    );
    await traverse(-1);
    assert.equal(requests.length, 4);
    assert.equal(applied.at(-1), "{fresh}");
  });

  it("stops a replay that a later navigation supersedes", async () => {
    responses.push(() =>
      withUrl(patchResponse(["{s}"]), "http://app.example/search"),
    );
    await click("#page");
    responses.push(() =>
      withUrl(patchResponse(["{c}"]), "http://app.example/cart?x=1"),
    );
    await click("#self");
    let land!: () => void;
    held = new Promise<void>((resolve) => (land = resolve));
    await traverse(-1);
    responses.push(() =>
      withUrl(patchResponse(["{i}"]), "http://app.example/item/3"),
    );
    await click("#item");
    land();
    await tick();
    assert.deepEqual(applied, ["{s}", "{c}", "{i}"]);
  });

  it("requests a traversal to another document's entry, wherever it points", async () => {
    // Only app code pushes an entry the router does not serve.
    history.pushState(null, "", "/api/x");
    await traverse(-1);
    responses.push(() =>
      withUrl(
        new Response("{}", { headers: { "content-type": "application/json" } }),
        "http://app.example/api/x",
      ),
    );
    await traverse(1);
    assert.equal(requests[0].url, "http://app.example/api/x");
    assert.equal(calls.at(-1), "reload");
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
    router(patch, /^\/search$/);
    const { style } = dom.window.document.documentElement;
    assert.equal(style.overflowAnchor, "none");
    maxScroll = 1000;
    dom.window.dispatchEvent(new dom.window.Event("load"));
    assert.deepEqual(calls, ["scrollTo 0,700", "scrollTo 0,700"]);
    assert.equal(scrollY, 700);
    assert.equal(style.overflowAnchor, "");
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
    router(patch, /^\/search$/);
    assert.deepEqual(calls, ["scrollTo 0,700"]);
  });
});

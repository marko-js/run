import assert from "node:assert/strict";

import { JSDOM } from "jsdom";

import { installPatchNavigation } from "../runtime/client";
import { buildIdHeader, patchContentType } from "../vite/constants";

const PAGE = `
  <a id="go" href="/next">next</a>
  <a id="hash" href="#top">top</a>
  <a id="external" href="http://elsewhere.test/x">away</a>
  <a id="tab" href="/next" target="_blank">tab</a>
  <form id="search" action="/search"><input name="q" value="phone"></form>
  <form id="mutate" action="/cart" method="post"></form>
`;

interface Reply {
  body?: string;
  type?: string;
  status?: number;
  url?: string;
  /** Rejects, as an aborted or failed request does. */
  fails?: boolean;
  /** Settles only once `release()` is called. */
  delay?: boolean;
}

function harness({ apply = true }: { apply?: boolean } = {}) {
  const dom = new JSDOM(`<body>${PAGE}</body>`, {
    url: "http://localhost/start",
  });
  const { window } = dom;
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const applied: string[] = [];
  const assigned: string[] = [];
  const navigated: string[] = [];
  const pending: (() => void)[] = [];
  const state = {
    reload: 0,
    reply: <Reply>{ body: "", type: patchContentType },
  };

  (window as any).__marko_apply_patch__ = (frame: string) => {
    applied.push(frame);
    return apply;
  };
  (window as any).__MARKO_RUN_BUILD_ID__ = "test-build";
  (window as any).fetch = async (url: URL, init: RequestInit) => {
    requests.push({
      url: String(url),
      headers: init.headers as Record<string, string>,
    });
    const { reply } = state;
    if (reply.fails) throw new Error("network");
    if (reply.delay) await new Promise<void>((r) => pending.push(r));
    return {
      ok: (reply.status ?? 200) < 400,
      url: reply.url ?? String(url),
      headers: {
        get: (k: string) =>
          k === "content-type" ? (reply.type ?? null) : null,
      },
      text: async () => reply.body ?? "",
    };
  };
  // jsdom will not navigate and its `location` is not replaceable, so the
  // listeners are installed against a facade over the real realm.
  const win = {
    document: window.document,
    addEventListener: window.addEventListener.bind(window),
    URL: window.URL,
    URLSearchParams: window.URLSearchParams,
    FormData: window.FormData,
    AbortSignal: { timeout: () => undefined },
    fetch: (window as any).fetch,
    __marko_apply_patch__: (window as any).__marko_apply_patch__,
    __MARKO_RUN_BUILD_ID__: "test-build",
    location: {
      href: "http://localhost/start",
      origin: "http://localhost",
      assign: (u: string) => assigned.push(u),
      reload: () => state.reload++,
    },
    history: {
      pushState: (_s: unknown, _t: string, u: string) =>
        navigated.push(`push ${u}`),
      replaceState: (_s: unknown, _t: string, u: string) =>
        navigated.push(`replace ${u}`),
    },
  };

  installPatchNavigation(win as any);

  const settle = () => new Promise((r) => setTimeout(r, 0));

  return {
    requests,
    applied,
    assigned,
    navigated,
    state,
    get reload() {
      return state.reload;
    },
    reply(next: Reply) {
      state.reply = next;
    },
    async release() {
      for (const resolve of pending.splice(0)) resolve();
      await settle();
      await settle();
    },
    goto(href: string) {
      win.location.href = href;
    },
    async click(selector: string) {
      const event = new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      window.document.querySelector(selector)!.dispatchEvent(event);
      await settle();
      return event;
    },
    async submit(selector: string) {
      const event = new window.Event("submit", {
        bubbles: true,
        cancelable: true,
      });
      window.document.querySelector(selector)!.dispatchEvent(event);
      await settle();
      return event;
    },
    async popstate() {
      window.dispatchEvent(new window.Event("popstate"));
      await settle();
    },
  };
}

describe("run/client-navigation", () => {
  it("patches an anchor navigation and keeps the document", async () => {
    const h = harness();
    h.reply({ body: "FRAME", type: patchContentType });
    const event = await h.click("#go");

    assert.equal(event.defaultPrevented, true);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].url, "http://localhost/next");
    assert.equal(h.requests[0].headers.accept, patchContentType);
    assert.equal(h.requests[0].headers[buildIdHeader], "test-build");
    assert.deepEqual(h.applied, ["FRAME"]);
    assert.deepEqual(h.navigated, ["push http://localhost/next"]);
    assert.deepEqual(h.assigned, []);
  });

  it("turns a GET form into a patch navigation with its fields", async () => {
    const h = harness();
    h.reply({ body: "FRAME", type: patchContentType });
    const event = await h.submit("#search");

    assert.equal(event.defaultPrevented, true);
    assert.equal(h.requests[0].url, "http://localhost/search?q=phone");
    assert.deepEqual(h.applied, ["FRAME"]);
  });

  it("leaves a POST form to the browser so a mutation runs once", async () => {
    const h = harness();
    const event = await h.submit("#mutate");

    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(h.requests, []);
  });

  it("falls back to a document when the frame is refused", async () => {
    const h = harness();
    h.reply({ body: "0", type: patchContentType });
    await h.click("#go");

    assert.deepEqual(h.applied, []);
    assert.deepEqual(h.assigned, ["http://localhost/next"]);
    assert.deepEqual(h.navigated, []);
  });

  it("does not ask twice for a route that refused", async () => {
    const h = harness();
    h.reply({ body: "0", type: patchContentType });
    await h.click("#go");
    const event = await h.click("#go");

    assert.equal(h.requests.length, 1);
    assert.equal(event.defaultPrevented, false);
  });

  it("falls back when the applier cannot apply a frame", async () => {
    const h = harness({ apply: false });
    h.reply({ body: "FRAME", type: patchContentType });
    await h.click("#go");

    assert.deepEqual(h.applied, ["FRAME"]);
    assert.deepEqual(h.assigned, ["http://localhost/next"]);
  });

  it("falls back when the server answers with a document", async () => {
    const h = harness();
    h.reply({ body: "<html>", type: "text/html;charset=UTF-8" });
    await h.click("#go");

    assert.deepEqual(h.assigned, ["http://localhost/next"]);
  });

  it("falls back on a non-2xx patch", async () => {
    const h = harness();
    h.reply({ body: "FRAME", type: patchContentType, status: 500 });
    await h.click("#go");

    assert.deepEqual(h.assigned, ["http://localhost/next"]);
  });

  it("records the settled url after a redirect", async () => {
    const h = harness();
    h.reply({
      body: "FRAME",
      type: patchContentType,
      url: "http://localhost/next/final",
    });
    await h.click("#go");

    assert.deepEqual(h.navigated, ["push http://localhost/next/final"]);
  });

  it("drops a superseded navigation instead of applying it late", async () => {
    const h = harness();
    // Both requests are held open, then released together so the first resolves
    // after the second has already started.
    h.reply({ body: "FIRST", type: patchContentType, delay: true });
    void h.click("#go");
    h.reply({ body: "SECOND", type: patchContentType, delay: true });
    void h.click("#go");
    await h.release();

    assert.equal(h.requests.length, 2);
    assert.deepEqual(
      h.applied,
      ["SECOND"],
      "only the newest navigation may touch the document",
    );
    assert.deepEqual(h.navigated, ["push http://localhost/next"]);
  });

  it("falls back rather than parking when the request fails", async () => {
    const h = harness();
    h.reply({ fails: true });
    await h.click("#go");

    assert.deepEqual(h.applied, []);
    assert.deepEqual(h.assigned, ["http://localhost/next"]);
  });

  it("ignores hash, cross-origin, targeted and modified clicks", async () => {
    const h = harness();
    for (const selector of ["#hash", "#external", "#tab"]) {
      const event = await h.click(selector);
      assert.equal(event.defaultPrevented, false, selector);
      assert.deepEqual(
        h.requests.map((r) => r.url),
        [],
        `${selector} triggered a patch request`,
      );
    }
  });

  it("patches a popstate to a different page", async () => {
    const h = harness();
    h.reply({ body: "FRAME", type: patchContentType });
    h.goto("http://localhost/back");
    await h.popstate();

    assert.deepEqual(h.applied, ["FRAME"]);
    assert.deepEqual(h.navigated, ["replace http://localhost/back"]);
    assert.equal(h.reload, 0);
  });

  it("reloads on popstate to a route already known to refuse", async () => {
    const h = harness();
    h.reply({ body: "0", type: patchContentType });
    await h.click("#go");
    assert.deepEqual(h.assigned, ["http://localhost/next"]);

    h.goto("http://localhost/next");
    await h.popstate();

    assert.equal(h.reload, 1, "a popstate cannot be cancelled, so it reloads");
    assert.equal(h.requests.length, 1, "the refused route is not asked again");
  });

  it("ignores a hash-only popstate", async () => {
    const h = harness();
    h.reply({ body: "FRAME", type: patchContentType });
    h.goto("http://localhost/start#section");
    await h.popstate();

    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.applied, []);
  });
});

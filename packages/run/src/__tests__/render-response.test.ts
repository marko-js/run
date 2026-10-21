import assert from "assert";

import {
  createContext,
  patchResponse,
  unmarkedRequest,
} from "../runtime/internal";

const kRender = Symbol.for("@marko/run.render");

function render(rendered: () => unknown) {
  const context = createContext(null, new Request("http://test/"), {});
  return context.render({ render: rendered } as any, {});
}

describe("Context Render", () => {
  it("should create the render's iterator eagerly and stash it with the body", () => {
    // Marko attaches its error handling when the iterator is created; the
    // body is lazy, so without the eager iterator a render that fails before
    // anything reads it (eg. a HEAD request) would throw uncaught.
    let iterators = 0;
    const response = render(() => ({
      [Symbol.asyncIterator]() {
        iterators++;
        return (async function* () {})();
      },
    }));

    assert.equal(iterators, 1);
    const direct = (response as any)[kRender];
    assert.ok(direct.render);
    assert.equal(direct.body, response.body);
    assert.equal(
      response.headers.get("content-type"),
      "text/html;charset=UTF-8",
    );
  });

  it("should not read from the render until the body is read", async () => {
    let pulled = false;
    const response = render(() => ({
      async *[Symbol.asyncIterator]() {
        pulled = true;
        yield "hi";
      },
    }));

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(pulled, false);
    assert.equal(await response.text(), "hi");
    assert.equal(pulled, true);
  });

  it("should not leak an unhandled rejection when cancelling a render whose cleanup fails", async () => {
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const response = render(() => ({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise<never>(() => {}),
          return: () => Promise.reject(new Error("cleanup failed")),
        }),
      }));

      await response.body!.cancel("client disconnected");
      // Unhandled rejections are reported after the current task's microtasks.
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(rejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  describe("in a patch build", () => {
    // The app template, and marko's headers as `@marko/vite/patch` binds them.
    const app = { patch: async function* () {} };
    const headers = (kind: "patch" | undefined): Record<string, string> =>
      kind
        ? {
            "content-type": "text/javascript;charset=UTF-8",
            "x-marko-patch": "1",
          }
        : {};
    const patchContext = (kind: "patch" | undefined) =>
      createContext(null, new Request("http://test/"), {}, undefined, {
        kind,
        app: app as any,
        headers,
      });

    it("should answer a patch request with the app's patch", async () => {
      const response = patchContext("patch").render(app as any, {} as any, {
        status: 404,
      });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("x-marko-patch"), "1");
      assert.equal(
        response.headers.get("content-type"),
        "text/javascript;charset=UTF-8",
      );
      assert.equal(await response.text(), "");
    });

    // The URL marker keys a patch apart from its document, so neither varies.
    it("should leave a document's own headers as they are", () => {
      const response = patchContext(undefined).render(
        { render: async function* () {} } as any,
        {} as any,
        { headers: { vary: "accept-language" } },
      );
      assert.equal(response.headers.get("vary"), "accept-language");
      assert.equal(response.headers.get("x-marko-patch"), null);
    });

    it("should answer a patch request for another template with a document", () => {
      const response = patchContext("patch").render(
        { render: async function* () {} } as any,
        {} as any,
      );
      assert.equal(response.headers.get("x-marko-patch"), null);
      assert.equal(
        response.headers.get("content-type"),
        "text/html;charset=UTF-8",
      );
    });

    // As the generated `invoke` does once marko's `patchRequestKind(headers, url)`
    // stripped the marker from `url` (here as marko does it).
    it("should hand a patch request's handlers no URL marker to read", async () => {
      const marked = new Request("http://test/cart?x=1&~", {
        method: "POST",
        headers: { "x-marko-patch": "b1;", "content-type": "text/plain" },
        body: "id=1",
      });
      const url = new URL(marked.url);
      const { search } = url;
      url.search = search.replace(/[?&]~$/, "");
      const request = unmarkedRequest(marked, url.search);
      const context = createContext(null, request, {}, url, {
        kind: "patch",
        app: app as any,
        headers,
      });
      assert.equal(context.request.url, "http://test/cart?x=1");
      assert.equal(context.url.href, "http://test/cart?x=1");
      assert.deepEqual(context.search, { x: "1" });
      // The rest of the request is the one the router sent.
      assert.equal(context.method, "POST");
      assert.equal(context.request.headers.get("x-marko-patch"), "b1;");
      assert.equal(await context.request.text(), "id=1");
      assert.equal(context.signal, request.signal);
    });

    // The router's fetch is same-origin, so one elsewhere would fail after
    // the handler ran.
    it("should answer a redirect elsewhere in-band, never stored", () => {
      const post = new Request("http://test/logout?~", { method: "POST" });
      const redirect = new Response(null, {
        status: 303,
        headers: {
          location: "https://sso.example/logout",
          "set-cookie": "session=; Max-Age=0",
        },
      });
      const response = patchResponse(redirect, post)!;
      assert.equal(response.status, 202);
      assert.equal(
        response.headers.get("location"),
        "https://sso.example/logout",
      );
      // A sign-out's cookie still clears.
      assert.equal(response.headers.get("set-cookie"), "session=; Max-Age=0");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("vary"), null);
    });

    // The router fetches the target as a patch, which a cache keys apart from
    // its document by the marker.
    it("should mark a redirect within the origin as the request was", () => {
      const request = new Request("http://test/cart?~", { method: "POST" });
      const marked = (response: Response) =>
        patchResponse(response, request)!.headers.get("location");
      assert.equal(
        marked(Response.redirect("http://test/done", 303)),
        "http://test/done?~",
      );
      assert.equal(
        marked(
          new Response(null, {
            status: 302,
            headers: { location: "/search?q=a%20b" },
          }),
        ),
        "http://test/search?q=a%20b&~",
      );
      // A redirect to the request's own URL keeps one marker, last.
      assert.equal(
        marked(Response.redirect("http://test/cart?~&x=1", 303)),
        "http://test/cart?x=1&~",
      );
      const redirect = patchResponse(
        new Response(null, {
          status: 307,
          headers: { location: "/cart", "set-cookie": "a=1" },
        }),
        request,
      )!;
      assert.equal(redirect.status, 307);
      assert.equal(redirect.headers.get("set-cookie"), "a=1");
    });

    it("should leave a response the router's fetch does not follow as it is", () => {
      const request = new Request("http://test/cart?~");
      const choices = new Response(null, {
        status: 300,
        headers: { location: "/a" },
      });
      assert.equal(patchResponse(choices, request), choices);
      assert.equal(patchResponse(undefined, request), undefined);
    });

    it("should keep a patch uncached whatever middleware set", () => {
      const response = patchContext("patch").render(app as any, {} as any);
      // Middleware that caches every page.
      response.headers.set("cache-control", "public, max-age=60");
      response.headers.set("vary", "cookie");
      assert.equal(
        patchResponse(response, new Request("http://test/")),
        response,
      );
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("vary"), "cookie");
    });

    it("should leave a document a patch request reached as it is", () => {
      const response = new Response("{}", {
        headers: { "cache-control": "public, max-age=60" },
      });
      patchResponse(response, new Request("http://test/"));
      assert.equal(response.headers.get("cache-control"), "public, max-age=60");
    });
  });

  it("should give the render a signal that aborts with its request", () => {
    // Marko 6 stops a render when `$global.signal` aborts, which is how a
    // client disconnect stops a page that is still rendering.
    const controller = new AbortController();
    const context = createContext(
      null,
      new Request("http://test/", { signal: controller.signal }),
      {},
    );
    let signal: AbortSignal | undefined;
    context.render(
      {
        render(input: { $global: { signal: AbortSignal } }) {
          signal = input.$global.signal;
          return (async function* () {})();
        },
      } as any,
      {},
    );

    assert.equal(signal, context.request.signal);
    controller.abort();
    assert.equal(signal!.aborted, true);
  });

  it("should fall back to `toReadable` for renders that cannot be iterated directly", async () => {
    const response = render(() => ({
      toReadable: () => new Response("legacy").body,
    }));

    assert.equal((response as any)[kRender], undefined);
    assert.equal(await response.text(), "legacy");
  });
});

describe("Context Render init", () => {
  function renderWith(init?: ResponseInit) {
    const context = createContext(null, new Request("http://test/"), {});
    return context.render(
      {
        render: () => ({
          async *[Symbol.asyncIterator]() {
            yield "hi";
          },
        }),
      } as any,
      {},
      init,
    );
  }

  it("should keep the HTML defaults when an init only sets a status", () => {
    const response = renderWith({ status: 400 });
    assert.equal(response.status, 400);
    assert.equal(
      response.headers.get("content-type"),
      "text/html;charset=UTF-8",
    );
  });

  it("should keep the content-type when an init sets other headers", () => {
    const response = renderWith({
      headers: { "cache-control": "no-store" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      response.headers.get("content-type"),
      "text/html;charset=UTF-8",
    );
  });

  it("should let an init override the content-type, including via Headers", () => {
    const response = renderWith({
      headers: new Headers({ "content-type": "text/plain" }),
    });
    assert.equal(response.headers.get("content-type"), "text/plain");
  });

  it("should keep the default content-type when a Headers instance omits it", () => {
    const response = renderWith({
      headers: new Headers({ "cache-control": "no-store" }),
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      response.headers.get("content-type"),
      "text/html;charset=UTF-8",
    );
  });
});

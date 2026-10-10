import assert from "assert";

import { createContext } from "../runtime/internal";

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
            vary: "x-marko-patch",
            "content-type": "text/javascript;charset=UTF-8",
            "x-marko-patch": "1",
          }
        : { vary: "x-marko-patch" };
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
      assert.equal(response.headers.get("vary"), "x-marko-patch");
      assert.equal(
        response.headers.get("content-type"),
        "text/javascript;charset=UTF-8",
      );
      assert.equal(await response.text(), "");
    });

    it("should vary a document by `x-marko-patch`", () => {
      const response = patchContext(undefined).render(
        { render: async function* () {} } as any,
        {} as any,
        { headers: { vary: "accept-language" } },
      );
      assert.equal(
        response.headers.get("vary"),
        "accept-language, x-marko-patch",
      );
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
  });

  it("should give a page render its request's signal", () => {
    const request = new Request("http://test/", {
      signal: new AbortController().signal,
    });
    let signal: unknown;
    createContext(null, request, {}).render(
      {
        render(input: { $global: { signal: unknown } }) {
          signal = input.$global.signal;
          return (async function* () {})();
        },
      } as any,
      {} as any,
    );
    assert.equal(signal, request.signal);
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

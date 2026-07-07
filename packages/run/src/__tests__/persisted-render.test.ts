import assert from "assert";

import { createContext } from "../runtime/internal";

// A rendered value that satisfies both branches of the runtime's `toReadable`
// (it exposes `.toReadable()` and is async-iterable), so the fake template
// works regardless of which branch `toReadable` memoized first. Only the
// response headers are under test, so the body is empty.
const rendered = {
  toReadable: () =>
    new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.close();
      },
    }),
  async *[Symbol.asyncIterator]() {
    /* empty */
  },
};
const fakeTemplate = { render: () => rendered } as any;

function context(persisted: boolean | "update") {
  const ctx = createContext(
    null,
    new Request("http://localhost/reports"),
    {} as any,
  ) as any;
  ctx.persisted = persisted;
  return ctx;
}

describe("persisted render() response headers", () => {
  it("update render (default init) advertises the patch content-type", () => {
    const res = context("update").render(fakeTemplate, {});
    assert.equal(
      res.headers.get("content-type"),
      "text/marko-patch;charset=UTF-8",
    );
    assert.equal(res.headers.get("vary"), "accept");
  });

  it("update render keeps the patch content-type/vary with a custom init", () => {
    // A handler that supplies its own init (custom status/headers) must not
    // lose the accept-negotiated patch content-type: the client router gates
    // a navigation on it and would otherwise silently fall back to a full
    // page load for that route.
    const res = context("update").render(
      fakeTemplate,
      {},
      {
        status: 201,
        headers: { "x-custom": "kept" },
      },
    );
    assert.equal(
      res.headers.get("content-type"),
      "text/marko-patch;charset=UTF-8",
    );
    assert.equal(res.headers.get("vary"), "accept");
    assert.equal(res.status, 201, "caller status preserved");
    assert.equal(
      res.headers.get("x-custom"),
      "kept",
      "caller headers preserved",
    );
  });

  it("update render preserves a caller's own vary tokens", () => {
    const res = context("update").render(
      fakeTemplate,
      {},
      {
        headers: { vary: "cookie" },
      },
    );
    assert.equal(res.headers.get("vary"), "cookie, accept");
  });

  it("persisted seed render still varies on accept with a custom init", () => {
    const res = context(true).render(
      fakeTemplate,
      {},
      {
        headers: { "cache-control": "private" },
      },
    );
    assert.equal(res.headers.get("vary"), "accept");
    assert.equal(res.headers.get("cache-control"), "private");
  });

  it("non-persisted render is untouched by a custom init", () => {
    const res = context(false).render(
      fakeTemplate,
      {},
      {
        status: 404,
        headers: { "content-type": "text/plain;charset=UTF-8" },
      },
    );
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("content-type"), "text/plain;charset=UTF-8");
    assert.equal(res.headers.get("vary"), null);
  });
});

describe("persisted render() possession echo (x-marko-have)", () => {
  // Captures the per-render options marko receives, so the decoded echo the
  // update render will consult is observable (only the options are under test).
  function renderPersisted(
    persisted: boolean | "update",
    headers?: Record<string, string>,
  ) {
    let options: any;
    const capturing = {
      render: (_input: unknown, opts: unknown) => ((options = opts), rendered),
    } as any;
    const ctx = createContext(
      null,
      new Request("http://localhost/reports", { headers }),
      {} as any,
    ) as any;
    ctx.persisted = persisted;
    ctx.render(capturing, {});
    return options?.persisted;
  }

  it("decodes the echo into `possessed` for an update render", () => {
    const persisted = renderPersisted("update", {
      "x-marko-have": '{"5 a":"a2","8 b":"a3"}',
    });
    assert.deepEqual(persisted.possessed, { "5 a": "a2", "8 b": "a3" });
  });

  it("omits `possessed` when the client sent no echo", () => {
    assert.equal(renderPersisted("update").possessed, undefined);
  });

  it("ignores a malformed echo rather than throwing", () => {
    // The header is untrusted client input: a bad value must degrade to no
    // echo (at worst a full-navigation fallback), never crash the render.
    assert.equal(
      renderPersisted("update", { "x-marko-have": "{not json" }).possessed,
      undefined,
    );
    assert.equal(
      renderPersisted("update", { "x-marko-have": '"a string"' }).possessed,
      undefined,
    );
  });

  it("does not honor the echo on a non-update persisted render", () => {
    // Only update renders consult possession; the initial (seed) document has
    // no live page to have anything, so its scopes are all fresh.
    assert.equal(
      renderPersisted(true, { "x-marko-have": '{"5 a":"a2"}' }).possessed,
      undefined,
    );
  });
});

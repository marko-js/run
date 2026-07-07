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

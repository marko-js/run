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

  it("should fall back to `toReadable` for renders that cannot be iterated directly", async () => {
    const response = render(() => ({
      toReadable: () => new Response("legacy").body,
    }));

    assert.equal((response as any)[kRender], undefined);
    assert.equal(await response.text(), "legacy");
  });
});

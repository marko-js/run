import assert from "assert";

import { call, NotHandled, NotMatched } from "../runtime/internal";

const context = { method: "GET", route: "/api", data: {} } as any;
const next = (() => new Response("from next")) as any;

function callWith(returned: unknown) {
  return call((() => returned) as any, next, context);
}

function withNodeEnv(value: string) {
  const previous = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = value;
  });
  afterEach(() => {
    process.env.NODE_ENV = previous;
  });
}

describe("call return value", () => {
  withNodeEnv("development");

  it("should pass a Response through", async () => {
    const response = new Response("ok");
    assert.equal(await callWith(response), response);
  });

  it("should continue when a handler returns nothing", async () => {
    assert.equal(await (await callWith(undefined)).text(), "from next");
  });

  it("should name the route and the contract for a non-Response", async () => {
    await assert.rejects(
      () => callWith({ items: [] }),
      /GET \/api returned a value of type "object" instead of a Response/,
    );
    await assert.rejects(() => callWith("body"), /type "string"/);
  });

  // A build can load more than one copy of the runtime module, so a returned
  // sentinel is not always the instance this copy created.
  it("should recognize a sentinel from another copy of the runtime", async () => {
    await assert.rejects(
      () => callWith(Symbol.for("marko-run not handled")),
      (error) => error === NotHandled,
    );
    await assert.rejects(
      () => callWith(Symbol.for("marko-run not matched")),
      (error) => error === NotMatched,
    );
  });

  describe("in production", () => {
    withNodeEnv("production");

    it("should leave the return value unchecked", async () => {
      const items = { items: [] };
      assert.equal(await callWith(items), items as never);
    });
  });
});

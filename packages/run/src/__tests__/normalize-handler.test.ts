import assert from "assert";

import { normalizeHandler, passthrough } from "../runtime/internal";

const handler = ((_ctx: unknown, next: () => unknown) => next()) as any;

function withVerb(verb: string) {
  return Object.assign(
    ((_ctx: unknown, next: () => unknown) => next()) as any,
    { verb },
  );
}

describe("normalizeHandler", () => {
  it("should pass a plain function through", () => {
    assert.equal(normalizeHandler(handler, "GET"), handler);
  });

  it("should allow a handler whose verb matches its export", () => {
    const get = withVerb("GET");
    assert.equal(normalizeHandler(get, "GET"), get);
  });

  it("should allow a Run.ALL handler under any verb export", () => {
    const all = withVerb("ALL");
    assert.equal(normalizeHandler(all, "DELETE"), all);
  });

  it("should reject a handler whose verb disagrees with its export", () => {
    assert.throws(
      () => normalizeHandler(withVerb("POST"), "GET"),
      /GET export of a handler was defined with Run\.POST/,
    );
    assert.throws(
      () => normalizeHandler([handler, withVerb("POST")] as any, "GET"),
      /Run\.POST/,
    );
  });

  it("should reject a truthy non-function export", () => {
    // Verb discovery keys off the export name alone, so this used to become
    // a registered route that quietly answered 204.
    assert.throws(
      () => normalizeHandler(42 as any, "GET"),
      /GET export of a handler to be a function or array of functions, but it was number/,
    );
    assert.throws(
      () => normalizeHandler({} as any),
      /middleware default export/,
    );
  });

  it("should reject a non-function array element", () => {
    assert.throws(
      () => normalizeHandler([handler, {}] as any, "GET"),
      /every element of the GET export of a handler to be a function, but one was object/,
    );
    assert.throws(
      () => normalizeHandler([42] as any),
      /every element of the middleware default export to be a function, but one was number/,
    );
  });

  it("should keep the passthrough for a nullish export", () => {
    assert.equal(normalizeHandler(undefined as any, "GET"), passthrough);
  });

  it("should reject a mismatched handler behind a promise on first call", async () => {
    const wrapped = normalizeHandler(Promise.resolve(withVerb("POST")), "GET");
    await assert.rejects(
      () => (wrapped as any)({}, () => undefined),
      /Run\.POST/,
    );
  });
});

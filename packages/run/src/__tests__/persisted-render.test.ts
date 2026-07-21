import assert from "assert";

import {
  createContext,
  initializePersisted,
  setPersisted,
} from "../runtime/internal";
import {
  createPatchRequestHeaders,
  isPatchResponse,
} from "../runtime/persisted-protocol";

// Covers both `toReadable` branches; response headers are the only output tested.
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

type PersistedRequest = false | { fromRoute?: string; targetRoute?: string };

function context(persisted: PersistedRequest) {
  const ctx = createContext(
    null,
    new Request("http://localhost/reports"),
    {} as any,
  ) as any;
  if (persisted) {
    const buildId = "current-build";
    setPersisted(
      ctx,
      persisted.fromRoute !== undefined && persisted.targetRoute !== undefined
        ? {
            buildId,
            patch: {
              fromRoute: persisted.fromRoute,
              targetRoute: persisted.targetRoute,
            },
          }
        : { buildId },
    );
  }
  return ctx;
}

describe("persisted render() response headers", () => {
  it("patch render (default init) advertises the patch content-type", () => {
    const res = context({ fromRoute: "2", targetRoute: "2" }).render(
      fakeTemplate,
      {},
    );
    assert.equal(
      res.headers.get("content-type"),
      "text/javascript;charset=UTF-8",
    );
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("vary"), "accept");
    // The client refuses to execute a patch body without this build echo.
    assert.equal(res.headers.get("x-marko-build"), "current-build");
  });

  it("patch render keeps the patch content-type/vary with a custom init", () => {
    // Custom response data must retain the negotiated patch content type.
    const res = context({ fromRoute: "2", targetRoute: "2" }).render(
      fakeTemplate,
      {},
      {
        status: 201,
        headers: { "x-custom": "kept" },
      },
    );
    assert.equal(
      res.headers.get("content-type"),
      "text/javascript;charset=UTF-8",
    );
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("vary"), "accept");
    assert.equal(res.headers.get("x-marko-build"), "current-build");
    assert.equal(res.status, 201, "caller status preserved");
    assert.equal(
      res.headers.get("x-custom"),
      "kept",
      "caller headers preserved",
    );
  });

  it("non-patch persisted renders carry no build echo", () => {
    // Document responses are never executed as frames; the echo is
    // patch-only so ordinary pages stay byte-identical across builds.
    const res = context({}).render(fakeTemplate, {});
    assert.equal(res.headers.get("x-marko-build"), null);
  });

  it("patch render preserves a caller's own vary tokens", () => {
    const res = context({ fromRoute: "2", targetRoute: "2" }).render(
      fakeTemplate,
      {},
      {
        headers: { vary: "cookie" },
      },
    );
    assert.equal(res.headers.get("vary"), "cookie, accept");
  });

  it("persisted document render still varies on accept with a custom init", () => {
    const res = context({}).render(
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

describe("persisted request negotiation", () => {
  function negotiate(headers: Record<string, string>, method = "GET") {
    const ctx = createContext(
      null,
      new Request("http://localhost/reports", { headers, method }),
      {} as any,
    ) as any;
    return {
      ctx,
      mismatch: initializePersisted(ctx, 2, "current-build", [undefined, 1, 1]),
    };
  }

  it("constructs and accepts one matching protocol request", () => {
    const headers = createPatchRequestHeaders(2, 1, "current-build");
    assert.deepEqual(headers, {
      accept: "text/marko-patch",
      "x-marko-route": "2",
      "x-marko-from": "1",
      "x-marko-build": "current-build",
    });

    const { ctx, mismatch } = negotiate(headers);
    assert.equal(mismatch, undefined);
    assert.equal("~run" in ctx, false);
    assert.equal("~run" in ctx.serializedGlobals, false);

    let options: any;
    ctx.render(
      {
        render: (_input: unknown, next: unknown) => (
          (options = next),
          rendered
        ),
      },
      {},
    );
    assert.equal(options.persisted.patch.fromRoute, "1");
    assert.equal(options.persisted.patch.targetRoute, "2");
  });

  it("rejects a malformed source route before rendering", () => {
    const headers = createPatchRequestHeaders(2, 1, "current-build");
    headers["x-marko-from"] = "__proto__";
    const { mismatch } = negotiate(headers);
    assert.equal(mismatch?.status, 409);
  });

  it("rejects a target that is not a persisted page", () => {
    const ctx = createContext(
      null,
      new Request("http://localhost/reports", {
        headers: createPatchRequestHeaders(2, 1, "current-build"),
      }),
      {} as any,
    ) as any;
    const mismatch = initializePersisted(ctx, 2, "current-build", []);
    assert.equal(mismatch?.status, 409);
  });

  it("rejects a stale build as a non-cacheable non-patch response", () => {
    const { mismatch } = negotiate(
      createPatchRequestHeaders(2, 1, "stale-build"),
    );
    assert.equal(mismatch?.status, 409);
    assert.equal(mismatch?.headers.get("cache-control"), "no-store");
    assert.equal(mismatch?.headers.get("vary"), "accept");
    assert.equal(isPatchResponse(mismatch!), false);
  });

  it("patches a matched mutation's direct response", () => {
    // Direct (non-PRG) POST responses re-render the current route with
    // validation state; a patch keeps the live page's user-edited state.
    const { ctx, mismatch } = negotiate(
      createPatchRequestHeaders(2, 2, "current-build"),
      "POST",
    );
    assert.equal(mismatch, undefined);

    let options: any;
    const response = ctx.render(
      {
        render: (_input: unknown, next: unknown) => (
          (options = next),
          rendered
        ),
      },
      {},
    );
    assert.equal(options.persisted.patch.fromRoute, "2");
    assert.equal(options.persisted.patch.targetRoute, "2");
    assert.equal(isPatchResponse(response), true);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-marko-build"), "current-build");
  });

  it("never rejects a mutation before its handler runs", () => {
    const { ctx, mismatch } = negotiate(
      createPatchRequestHeaders(2, 1, "stale-build"),
      "POST",
    );
    assert.equal(mismatch, undefined);

    // The mismatched mutation still runs, rendering the ordinary document
    // (no patch facts) for the client's fallback.
    let options: any;
    const response = ctx.render(
      {
        render: (_input: unknown, next: unknown) => (
          (options = next),
          rendered
        ),
      },
      {},
    );
    assert.equal(options.persisted.patch, undefined);
    assert.match(String(response.headers.get("content-type")), /text\/html/);
    assert.equal(response.headers.get("vary"), "accept");
    assert.equal(response.headers.get("x-marko-build"), null);
  });
});

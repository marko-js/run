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
    const descriptor = "target descriptor";
    setPersisted(
      ctx,
      persisted.fromRoute !== undefined && persisted.targetRoute !== undefined
        ? {
            descriptor,
            patch: {
              fromRoute: persisted.fromRoute,
              targetRoute: persisted.targetRoute,
            },
          }
        : { descriptor },
    );
  }
  return ctx;
}

describe("persisted render() response headers", () => {
  it("update render (default init) advertises the patch content-type", () => {
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
  });

  it("update render keeps the patch content-type/vary with a custom init", () => {
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
    assert.equal(res.status, 201, "caller status preserved");
    assert.equal(
      res.headers.get("x-custom"),
      "kept",
      "caller headers preserved",
    );
  });

  it("update render preserves a caller's own vary tokens", () => {
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
      mismatch: initializePersisted(ctx, 2, "current-build", [
        undefined,
        "source descriptor",
        "target descriptor",
      ]),
    };
  }

  it("constructs and accepts one matching protocol request", () => {
    const headers = createPatchRequestHeaders(
      2,
      1,
      "current-build",
      '{"site":"renderer"}',
    );
    assert.deepEqual(headers, {
      accept: "text/marko-patch",
      "x-marko-route": "2",
      "x-marko-from": "1",
      "x-marko-build": "current-build",
      "x-marko-have": '{"site":"renderer"}',
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
    assert.equal(options.persisted.patch.have, '{"site":"renderer"}');
    assert.equal(options.persisted.patch.source, "source descriptor");
    assert.equal(options.persisted.descriptor, "target descriptor");
  });

  it("rejects a malformed source route before rendering", () => {
    const headers = createPatchRequestHeaders(
      2,
      1,
      "current-build",
      "opaque-token",
    );
    headers["x-marko-from"] = "__proto__";
    const { mismatch } = negotiate(headers);
    assert.equal(mismatch?.status, 409);
  });

  it("rejects a target without a generated descriptor", () => {
    const ctx = createContext(
      null,
      new Request("http://localhost/reports", {
        headers: createPatchRequestHeaders(2, 1, "current-build", ""),
      }),
      {} as any,
    ) as any;
    const mismatch = initializePersisted(ctx, 2, "current-build", []);
    assert.equal(mismatch?.status, 409);
  });

  it("rejects a stale build as a non-cacheable non-patch response", () => {
    const { mismatch } = negotiate(
      createPatchRequestHeaders(2, 1, "stale-build", ""),
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
      createPatchRequestHeaders(2, 2, "current-build", ""),
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
  });

  it("never rejects a mutation before its handler runs", () => {
    const { ctx, mismatch } = negotiate(
      createPatchRequestHeaders(2, 1, "stale-build", ""),
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
  });
});

describe("persisted render() possession echo (x-marko-have)", () => {
  function renderPersisted(
    fromRoute: string | undefined,
    headers?: Record<string, string>,
    descriptors: readonly unknown[] = [
      undefined,
      undefined,
      "target descriptor",
    ],
    targetRoute = 2,
  ) {
    let options: any;
    const capturing = {
      render: (_input: unknown, opts: unknown) => ((options = opts), rendered),
    } as any;
    const requestHeaders = fromRoute
      ? {
          ...createPatchRequestHeaders(
            targetRoute,
            +fromRoute,
            "current-build",
            "",
          ),
          ...headers,
          "x-marko-from": fromRoute,
        }
      : headers;
    const ctx = createContext(
      null,
      new Request("http://localhost/reports", { headers: requestHeaders }),
      {} as any,
    ) as any;
    const mismatch = initializePersisted(
      ctx,
      targetRoute,
      "current-build",
      descriptors,
    );
    assert.equal(mismatch, undefined);
    ctx.render(capturing, {});
    return options?.persisted;
  }

  it("passes the echo through opaquely for an update render", () => {
    const persisted = renderPersisted("2", {
      "x-marko-have": "P!not-json!",
    });
    assert.equal(persisted.patch.have, "P!not-json!");
  });

  it("omits `have` when the client sent no echo", () => {
    const persisted = renderPersisted("2");
    assert.equal(persisted.patch.have, undefined);
    assert.equal(persisted.patch.source, undefined);
  });

  it("selects source and target descriptors for a cross-route patch", () => {
    const persisted = renderPersisted(
      "2",
      { "x-marko-have": "Ptoken" },
      [undefined, undefined, "source descriptor", "target descriptor"],
      3,
    );
    assert.equal(persisted.patch.fromRoute, "2");
    assert.equal(persisted.patch.targetRoute, "3");
    assert.equal(persisted.patch.have, "Ptoken");
    assert.equal(persisted.patch.source, "source descriptor");
    assert.equal(persisted.descriptor, "target descriptor");
  });

  it("forwards the route descriptor to an initial document render", () => {
    const persisted = renderPersisted(undefined, undefined, [
      undefined,
      undefined,
      "target descriptor",
    ]);
    assert.equal(persisted.patch, undefined);
    assert.equal(persisted.descriptor, "target descriptor");
  });

  it("omits an oversized echo", () => {
    assert.equal(
      renderPersisted("2", { "x-marko-have": "x".repeat(4097) }).patch.have,
      undefined,
    );
  });

  it("does not honor the echo on a non-update persisted render", () => {
    assert.equal(
      renderPersisted(undefined, { "x-marko-have": "Ptoken" }).patch?.have,
      undefined,
    );
  });

  it("drops have when the valid source route has no descriptor", () => {
    const persisted = renderPersisted("1", { "x-marko-have": "Ptoken" }, [
      undefined,
      undefined,
      "target descriptor",
    ]);
    assert.equal(persisted.patch.fromRoute, "1");
    assert.equal(persisted.patch.have, undefined);
    assert.equal(persisted.patch.source, undefined);
    assert.equal(persisted.descriptor, "target descriptor");
  });
});

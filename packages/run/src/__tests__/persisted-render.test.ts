import assert from "assert";

import { createContext, setPersisted } from "../runtime/internal";
import { encodeHave } from "../runtime/persisted-navigation";

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

type PersistedRequest = false | { fromRoute?: string; targetRoute?: string };

function context(persisted: PersistedRequest) {
  const ctx = createContext(
    null,
    new Request("http://localhost/reports"),
    {} as any,
  ) as any;
  if (persisted) {
    setPersisted(ctx, persisted.fromRoute, persisted.targetRoute);
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
    // A handler that supplies its own init (custom status/headers) must not
    // lose the accept-negotiated patch content-type: the client router gates
    // a navigation on it and would otherwise silently fall back to a full
    // page load for that route.
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

describe("persisted render() class-API second-argument guard", () => {
  // Marko 5 (runtime-class/class-API) templates take render()'s second
  // argument as a writer/out/callback and throw on first write when handed a
  // plain options object -- so `context.render` must only pass the persisted
  // options to templates that understand them. Class-API templates are
  // detected structurally (they always carry `createOut`, see
  // runtime-class's `renderable.js`); runtime-tags templates never do.
  function renderWith(template: any, persisted: PersistedRequest) {
    let options: any;
    const capturing = {
      ...template,
      render: (_input: unknown, opts: unknown) => ((options = opts), rendered),
    };
    const ctx = createContext(
      null,
      new Request("http://localhost/reports"),
      {} as any,
    ) as any;
    if (persisted) {
      setPersisted(ctx, persisted.fromRoute, persisted.targetRoute);
    }
    ctx.render(capturing, {});
    return options;
  }

  it("omits render options for a class-API (createOut-carrying) template", () => {
    assert.equal(
      renderWith({ createOut: () => {} }, { fromRoute: "2", targetRoute: "2" }),
      undefined,
    );
    assert.equal(renderWith({ createOut: () => {} }, {}), undefined);
  });

  it("still passes render options for a runtime-tags template", () => {
    assert.notEqual(
      renderWith({}, { fromRoute: "2", targetRoute: "2" }),
      undefined,
    );
    assert.notEqual(renderWith({}, {}), undefined);
  });
});

describe("persisted render() possession echo (x-marko-have)", () => {
  // Captures the per-render options marko receives, so the decoded echo the
  // update render will consult is observable (only the options are under test).
  function renderPersisted(
    persisted: Exclude<PersistedRequest, false>,
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
    setPersisted(ctx, persisted.fromRoute, persisted.targetRoute);
    ctx.render(capturing, {});
    return options?.persisted;
  }

  it("decodes the echo into `possessed` for an update render", () => {
    const persisted = renderPersisted(
      { fromRoute: "2", targetRoute: "2" },
      {
        "x-marko-have": '{"5 a":"a2","8 b":"a3"}',
      },
    );
    assert.deepEqual(persisted.patch.possessed, {
      "5 a": "a2",
      "8 b": "a3",
    });
  });

  it("omits `possessed` when the client sent no echo", () => {
    assert.equal(
      renderPersisted({ fromRoute: "2", targetRoute: "2" }).patch.possessed,
      undefined,
    );
  });

  it("couples cross-route fragment delivery to fresh-scope seeding", () => {
    const persisted = renderPersisted({
      fromRoute: "2",
      targetRoute: "3",
    });
    assert.equal(persisted.patch.fromRoute, "2");
    assert.equal(persisted.patch.targetRoute, "3");
  });

  it("ignores a malformed echo rather than throwing", () => {
    // The header is untrusted client input: a bad value must degrade to no
    // echo (at worst a full-navigation fallback), never crash the render.
    assert.equal(
      renderPersisted(
        { fromRoute: "2", targetRoute: "2" },
        { "x-marko-have": "{not json" },
      ).patch.possessed,
      undefined,
    );
    assert.equal(
      renderPersisted(
        { fromRoute: "2", targetRoute: "2" },
        { "x-marko-have": '"a string"' },
      ).patch.possessed,
      undefined,
    );
  });

  it("does not honor the echo on a non-update persisted render", () => {
    // Only update renders consult possession; the initial (seed) document has
    // no live page to have anything, so its scopes are all fresh.
    assert.equal(
      renderPersisted({}, { "x-marko-have": '{"5 a":"a2"}' }).patch?.possessed,
      undefined,
    );
  });

  it("rejects an array echo rather than passing it through", () => {
    // `typeof [] === "object"` passes a bare object check; the client only
    // ever sends a plain object, so an array is malformed input.
    assert.equal(
      renderPersisted(
        { fromRoute: "2", targetRoute: "2" },
        { "x-marko-have": '["a","b"]' },
      ).patch.possessed,
      undefined,
    );
  });

  it("does not let a prototype-chain key produce a spurious hit", () => {
    // A plain `JSON.parse` result inherits `Object.prototype`, so
    // `"toString" in possessed` (the shape of the downstream lookup) would
    // spuriously be true even for an echo that never mentioned that site --
    // and `__proto__` is valid JSON, landing as an own data property rather
    // than repointing the prototype. `possessed` must not expose either.
    const possessed = renderPersisted(
      { fromRoute: "2", targetRoute: "2" },
      {
        "x-marko-have": '{"__proto__":{"polluted":"yes"},"5 a":"a2"}',
      },
    ).patch.possessed;
    assert.equal(
      "toString" in possessed,
      false,
      "must not inherit Object.prototype",
    );
    assert.equal(
      ({} as any).polluted,
      undefined,
      "must not pollute Object.prototype globally",
    );
    assert.equal(possessed["5 a"], "a2");
  });
});

describe("client possession echo encoding (encodeHave)", () => {
  it("passes small, ASCII-only payloads through unchanged", () => {
    const json = '{"5 a":"a2","8 b":"a3"}';
    assert.equal(encodeHave(json), json);
  });

  it("passes an empty string through unchanged (header stays omitted)", () => {
    assert.equal(encodeHave(""), "");
  });

  it("escapes non-ASCII loop-key data so the header stays ISO-8859-1-safe", () => {
    // fetch() throws setting a header value with bytes outside that range;
    // JSON.stringify (marko's `_have`) does not escape non-ASCII characters.
    const json = JSON.stringify({ "5 café": "a2" });
    const encoded = encodeHave(json);
    assert.ok(/^[\x00-\x7f]*$/.test(encoded), "must be ASCII-only");
    assert.deepEqual(JSON.parse(encoded), JSON.parse(json));
  });

  it("omits the echo entirely once the encoded value crosses ~4 KB", () => {
    // A too-large header risks the whole request being rejected by a
    // header-size cap -- strictly worse than sending no echo.
    const big = JSON.stringify({ a: "x".repeat(5000) });
    assert.equal(encodeHave(big), "");
  });

  it("keeps a payload just under the cap", () => {
    const json = JSON.stringify({ a: "x".repeat(100) });
    assert.equal(encodeHave(json), json);
  });
});

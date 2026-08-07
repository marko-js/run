import assert from "assert";

import handler, { config } from "../default-edge-entry";

// `@marko/run/router` dispatches through `globalThis.__marko_run__` when it
// is called, so stubbing the global exercises the real entry.
type RuntimeGlobal = typeof globalThis & {
  __marko_run__?: { fetch(request: Request, platform: unknown): unknown };
};

describe("netlify default-edge-entry", () => {
  afterEach(() => {
    delete (globalThis as RuntimeGlobal).__marko_run__;
  });

  function stubRouter(fetch: (request: Request, platform: unknown) => unknown) {
    (globalThis as RuntimeGlobal).__marko_run__ = { fetch };
  }

  function stubContext(next: () => Response) {
    let nextCalls = 0;
    const context = {
      next() {
        nextCalls++;
        return Promise.resolve(next());
      },
    };
    return { context: context as never, nextCalls: () => nextCalls };
  }

  it("serves a dotted path from the router when no static file exists", async () => {
    const request = new Request("http://test/reports/report.2024.pdf");
    let platform: unknown;
    stubRouter((req, plat) => {
      assert.equal(req, request);
      platform = plat;
      return new Response("route");
    });
    const { context, nextCalls } = stubContext(
      () => new Response(null, { status: 404 }),
    );

    const response = await handler(request, context);

    assert.equal(nextCalls(), 1, "checks the static file first");
    assert.equal(platform, context, "passes the context as the platform");
    assert.equal(await response.text(), "route");
  });

  it("prefers an existing static file over the router", async () => {
    stubRouter(() => {
      throw new Error("the router must not run for a served static file");
    });
    const { context } = stubContext(() => new Response("static"));

    const response = await handler(
      new Request("http://test/logo.svg"),
      context,
    );

    assert.equal(await response.text(), "static");
  });

  it("returns the router's 404 instead of the platform 404", async () => {
    stubRouter(() => new Response("app 404", { status: 404 }));
    const { context } = stubContext(
      () => new Response("platform 404", { status: 404 }),
    );

    const response = await handler(new Request("http://test/missing"), context);

    assert.equal(response.status, 404);
    assert.equal(await response.text(), "app 404");
  });

  it("returns the platform response when the router declines", async () => {
    stubRouter(() => undefined);
    const { context } = stubContext(
      () => new Response("platform 404", { status: 404 }),
    );

    const response = await handler(new Request("http://test/missing"), context);

    assert.equal(await response.text(), "platform 404");
  });

  it("checks static files for HEAD requests", async () => {
    stubRouter(() => undefined);
    const { context, nextCalls } = stubContext(() => new Response("static"));

    const response = await handler(
      new Request("http://test/logo.svg", { method: "HEAD" }),
      context,
    );

    assert.equal(nextCalls(), 1);
    assert.equal(await response.text(), "static");
  });

  it("routes other methods without a static check", async () => {
    const request = new Request("http://test/api/thing", { method: "POST" });
    stubRouter(() => new Response("created", { status: 201 }));
    const { context, nextCalls } = stubContext(() => {
      throw new Error("next() must not run for a POST");
    });

    const response = await handler(request, context);

    assert.equal(nextCalls(), 0);
    assert.equal(response.status, 201);
  });

  it("answers 404 for a declined non-GET request", async () => {
    stubRouter(() => undefined);
    const { context } = stubContext(() => new Response("static"));

    const response = await handler(
      new Request("http://test/api/thing", { method: "POST" }),
      context,
    );

    assert.equal(response.status, 404);
  });

  it("runs on every path", () => {
    assert.equal(config.path, "/*");
    assert.equal(config.pattern, undefined);
  });
});

import assert from "assert";

import { createContext } from "../runtime/internal";
import type { RouteMatch } from "../runtime/types";

const route: RouteMatch = {
  handler: (async () => new Response()) as any,
  path: "/users/$id",
  params: { id: "42" },
  options: {} as any,
  meta: {},
};

function createTestContext(url = "http://localhost/users/42?foo=1&bar=a") {
  return createContext(route, new Request(url), {});
}

describe("context", () => {
  // Marko's tags API runtime shallow copies `$global` when rendering, so the
  // context only works in templates if all of its members are own enumerable
  // properties that survive a spread.
  describe("spread like Marko does with $global", () => {
    it("keeps methods", () => {
      const $global = { renderId: "_", ...createTestContext() };
      assert.equal(typeof $global.fetch, "function");
      assert.equal(typeof $global.render, "function");
      assert.equal(typeof $global.redirect, "function");
      assert.equal(typeof $global.back, "function");
    });

    it("keeps params and search", () => {
      const $global = { renderId: "_", ...createTestContext() };
      assert.deepEqual($global.params, { id: "42" });
      assert.deepEqual($global.search, { foo: "1", bar: "a" });
      assert.equal($global.url.pathname, "/users/42");
      assert.equal($global.route, "/users/$id");
    });

    it("redirect resolves against the context url", () => {
      const { redirect } = { ...createTestContext() };
      const response = redirect("/login");
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "http://localhost/login");
    });
  });

  describe("fetch", () => {
    const marko_run_global = globalThis as unknown as {
      __marko_run__: unknown;
    };
    const original = marko_run_global.__marko_run__;
    let fetched: Request | undefined;

    before(() => {
      marko_run_global.__marko_run__ = {
        async fetch(request: Request) {
          fetched = request;
          return new Response("ok");
        },
      };
    });

    after(() => {
      marko_run_global.__marko_run__ = original;
    });

    it("works when detached from the context", async () => {
      const { fetch } = { ...createTestContext() };
      const response = await fetch("/other");
      assert.equal(await response.text(), "ok");
      assert.equal(fetched?.url, "http://localhost/other");
    });
  });
});

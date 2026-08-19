import assert from "assert";

import { createContext, normalizeOptions } from "../runtime/internal";
import type { RouteMatch } from "../runtime/types";

function contextFor(options: Parameters<typeof normalizeOptions>[1]) {
  const route: RouteMatch = {
    handler: async () => new Response(),
    path: "/notes",
    params: {},
    options: normalizeOptions("POST", options ?? {}),
    meta: {},
  };
  const request = new Request("http://test/notes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "hi" }),
  });
  return createContext(route, request, {});
}

describe("context.body", () => {
  it("should be undefined when the merged options have no validator", () => {
    assert.equal(contextFor({}).body, undefined);
    assert.equal(
      contextFor({ json: { maxBytes: 1024 } } as any).body,
      undefined,
    );
    assert.equal(contextFor({ form: { maxFiles: 1 } } as any).body, undefined);
  });

  it("should resolve the validated body when a validator is declared", async () => {
    const context = contextFor({
      json: (value: any) => ({ title: String(value.title) }),
    } as any);
    assert.deepEqual(await context.body, { title: "hi" });
  });

  it("should be defined when middleware limits merge with a handler validator", () => {
    const route: RouteMatch = {
      handler: async () => new Response(),
      path: "/notes",
      params: {},
      options: normalizeOptions(
        "POST",
        { json: { maxBytes: 1024 } } as any,
        { json: (value: unknown) => value } as any,
      ),
      meta: {},
    };
    const request = new Request("http://test/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.notEqual(createContext(route, request, {}).body, undefined);
  });

  it("should reject a media type whose option has no validator with a 415", async () => {
    const route: RouteMatch = {
      handler: async () => new Response(),
      path: "/notes",
      params: {},
      options: normalizeOptions("POST", {
        json: (value: unknown) => value,
        form: { maxFiles: 1 },
      } as any),
      meta: {},
    };
    const request = new Request("http://test/notes", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "title=hi",
    });
    await assert.rejects(
      () => createContext(route, request, {}).body!,
      /Unsupported content type/,
    );
  });
});

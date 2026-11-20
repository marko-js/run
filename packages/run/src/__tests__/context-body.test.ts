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

function formContext(
  body: string | FormData,
  options: Parameters<typeof normalizeOptions>[1],
  url = "http://test/notes",
  headers: Record<string, string> = {},
) {
  const route: RouteMatch = {
    handler: async () => new Response(),
    path: "/notes",
    params: {},
    options: normalizeOptions("POST", options),
    meta: {},
  };
  const request = new Request(url, { method: "POST", headers, body });
  return createContext(route, request, {});
}

const identity = { form: (value: unknown) => value } as any;
const urlencoded = { "content-type": "application/x-www-form-urlencoded" };

function assertOwnFields(data: any, field: string, value: unknown) {
  assert.equal(Object.getPrototypeOf(data), Object.prototype);
  assert.ok(Object.hasOwn(data, field));
  assert.deepEqual(data[field], value);
}

describe("form field parsing", () => {
  it("should keep inherited names as own fields in the query string", () => {
    const { search } = formContext(
      "",
      {},
      "http://test/notes?__proto__=x&toString=y&constructor=z",
    );
    assertOwnFields(search, "__proto__", "x");
    assertOwnFields(search, "toString", "y");
    assertOwnFields(search, "constructor", "z");
  });

  it("should keep inherited names as own fields in a urlencoded body", async () => {
    const data = await formContext(
      "__proto__=x&toString=y&constructor=z&constructor=w",
      identity,
      undefined,
      urlencoded,
    ).body;
    assertOwnFields(data, "__proto__", "x");
    assertOwnFields(data, "toString", "y");
    assertOwnFields(data, "constructor", ["z", "w"]);
  });

  it("should keep inherited names as own fields in a multipart body", async () => {
    const form = new FormData();
    form.append("__proto__", "x");
    form.append("toString", "y");
    form.append("toString", "z");
    const data = await formContext(form, identity).body;
    assertOwnFields(data, "__proto__", "x");
    assertOwnFields(data, "toString", ["y", "z"]);
  });

  it("should keep a leading question mark in the first urlencoded key", async () => {
    const data: any = await formContext(
      "?a=1&b=2",
      identity,
      undefined,
      urlencoded,
    ).body;
    assert.deepEqual(Object.keys(data), ["?a", "b"]);
  });

  it("should decode urlencoded pairs", async () => {
    const data = await formContext(
      "a=1+2&b=%E2%9C%93&c&&d=",
      identity,
      undefined,
      urlencoded,
    ).body;
    assert.deepEqual(data, { a: "1 2", b: "✓", c: "", d: "" });
  });

  // Each repeated-key body is timed against a body of the same size and
  // shape with distinct keys, which has always parsed in linear time.
  const count = 60_000;
  const timings = [
    ["without values", () => "a", (i: number) => `k${i}`],
    ["with empty values", () => "a=", (i: number) => `k${i}=`],
  ] as const;

  for (const [name, repeated, distinct] of timings) {
    it(`should parse many repeated urlencoded keys ${name} in linear time`, async () => {
      const time = async (key: (i: number) => string) => {
        const body = Array.from({ length: count }, (_, i) => key(i)).join("&");
        const start = performance.now();
        await formContext(body, identity, undefined, urlencoded).body;
        return performance.now() - start;
      };
      const control = await time(distinct);
      const elapsed = await time(repeated);
      assert.ok(
        elapsed < control * 10 + 100,
        `repeated keys took ${elapsed.toFixed(0)}ms against ${control.toFixed(0)}ms for distinct keys`,
      );
    }).timeout(60_000);
  }
});

function chunkedContext(
  chunks: Uint8Array[],
  options: Parameters<typeof normalizeOptions>[1],
  contentType: string,
) {
  const route: RouteMatch = {
    handler: async () => new Response(),
    path: "/notes",
    params: {},
    options: normalizeOptions("POST", options),
    meta: {},
  };
  const request = new Request("http://test/notes", {
    method: "POST",
    headers: { "content-type": contentType },
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    // @ts-expect-error: Node requires this for streams
    duplex: "half",
  });
  return createContext(route, request, {});
}

const errorStatus = (error: any) => error[Symbol.for("@marko/run.errorStatus")];

describe("body reading", () => {
  const json = { json: (value: unknown) => value } as any;
  const bytes = new TextEncoder().encode('{"title":"héllo €"}');
  const euro = bytes.indexOf(0xe2);

  it("should decode a character split across chunks", async () => {
    const body = await chunkedContext(
      [bytes.subarray(0, euro + 1), bytes.subarray(euro + 1)],
      json,
      "application/json",
    ).body;
    assert.deepEqual(body, { title: "héllo €" });
  });

  it("should decode a urlencoded body read in many chunks", async () => {
    const encoded = new TextEncoder().encode("a=1&b=%C3%A9&c=é");
    const chunks = [...encoded].map((byte) => Uint8Array.of(byte));
    const body = await chunkedContext(
      chunks,
      identity,
      "application/x-www-form-urlencoded",
    ).body;
    assert.deepEqual({ ...(body as object) }, { a: "1", b: "é", c: "é" });
  });

  it("should answer 413 once the chunks pass the limit", async () => {
    await assert.rejects(
      () =>
        chunkedContext(
          [bytes.subarray(0, 8), bytes.subarray(8)],
          { json: { maxBytes: 10, validator: json.json } } as any,
          "application/json",
        ).body!,
      (error) => errorStatus(error) === 413,
    );
  });

  it("should answer 400 for malformed UTF-8", async () => {
    await assert.rejects(
      () =>
        chunkedContext(
          [Uint8Array.of(0x7b, 0xff, 0x7d)],
          json,
          "application/json",
        ).body!,
      (error) => errorStatus(error) === 400,
    );
  });

  it("should stop reading the body once it is rejected", async () => {
    for (const [options, chunk, status] of [
      [json, Uint8Array.of(0xff), 400],
      [{ json: { maxBytes: 4, validator: json.json } }, bytes, 413],
    ] as const) {
      let cancelled = false;
      const request = new Request("http://test/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Never closes, so only a cancel ends the read.
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(chunk);
          },
          cancel() {
            cancelled = true;
          },
        }),
        // @ts-expect-error: Node requires this for streams
        duplex: "half",
      });
      const route: RouteMatch = {
        handler: async () => new Response(),
        path: "/notes",
        params: {},
        options: normalizeOptions("POST", options as any),
        meta: {},
      };
      await assert.rejects(
        () => createContext(route, request, {}).body!,
        (error) => errorStatus(error) === status,
      );
      assert.equal(cancelled, true);
    }
  });

  it("should answer 400 for a character cut off at the end", async () => {
    await assert.rejects(
      () =>
        chunkedContext([bytes.subarray(0, euro + 1)], json, "application/json")
          .body!,
      (error) => errorStatus(error) === 400,
    );
  });
});

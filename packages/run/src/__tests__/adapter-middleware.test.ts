import assert from "assert";
import http from "http";

import { copyResponseHeaders, getRender } from "../adapter/middleware";

const kRender = Symbol.for("@marko/run.render");
const encoder = new TextEncoder();

function pageResponse(html: string[]) {
  const render = (async function* () {
    yield* html;
  })();
  const response = new Response(
    new ReadableStream({
      pull(ctrl) {
        for (const chunk of html) {
          ctrl.enqueue(encoder.encode(chunk));
        }
        ctrl.close();
      },
    }),
  );
  (response as any)[kRender] = { render, body: response.body };
  return response;
}

async function collect(body: AsyncIterable<string | Uint8Array> | null) {
  const decoder = new TextDecoder();
  let out = "";
  for await (const chunk of body!) {
    out +=
      typeof chunk === "string"
        ? chunk
        : decoder.decode(chunk, { stream: true });
  }
  return out + decoder.decode();
}

describe("Adapter Middleware", () => {
  describe("copyResponseHeaders", () => {
    it("should preserve existing cookies set", () => {
      const expected = ["a=1", "b=2", "c=3", "d=4"];

      const initial = expected.slice(0, 2);
      const added = expected.slice(2);

      const response = new Response();
      for (const cookie of added) {
        response.headers.append("set-cookie", cookie);
      }

      const res = new http.ServerResponse({ method: "GET" } as any);
      res.setHeader("set-cookie", initial);

      assert.deepEqual(res.getHeader("set-cookie"), initial);

      copyResponseHeaders(res, response.headers);
      const actual = res.getHeader("set-cookie");

      assert.deepEqual(actual, expected);
    });
  });

  describe("getRender", () => {
    it("should take the stashed render for an untouched page response", async () => {
      assert.equal(await collect(getRender(pageResponse(["a", "b"]))), "ab");
    });

    it("should fall back to the body of a response without a render", async () => {
      assert.equal(await collect(getRender(new Response("plain"))), "plain");
    });

    it("should fall back to the body once `clone()` has teed it", async () => {
      // Cloning drains the single-use render into the two teed branches, so the
      // render no longer holds the output and the body does.
      const response = pageResponse(["a", "b"]);
      const clone = response.clone();

      assert.equal(await clone.text(), "ab");
      assert.equal(await collect(getRender(response)), "ab");
    });

    it("should fall back to the body once it has been read", async () => {
      const response = pageResponse(["a", "b"]);
      await response.text();

      assert.equal(getRender(response), response.body);
    });
  });
});

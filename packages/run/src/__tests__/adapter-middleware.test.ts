import assert from "assert";
import http from "http";
import type { AddressInfo } from "net";

import {
  copyResponseHeaders,
  createMiddleware,
  getRender,
} from "../adapter/middleware";
import type { Fetch } from "../runtime";

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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

async function serve(fetch: Fetch<any>) {
  const server = http.createServer(createMiddleware(fetch));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
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

  describe("createMiddleware", () => {
    it("should abort the request signal and cancel an idle stream when the client disconnects", async () => {
      const cancelled = deferred();
      let signal!: AbortSignal;
      let cancelReason = "not cancelled";

      // Enqueues once so the head is flushed, then goes quiet -- the "push only
      // when data changes" shape. Nothing pulls again, so the write loop sits in
      // `next()` and only the abort can end it.
      const server = await serve(async (request) => {
        signal = request.signal;
        return new Response(
          new ReadableStream({
            start(ctrl) {
              ctrl.enqueue(encoder.encode("open\n"));
            },
            cancel(reason) {
              cancelReason = String(reason);
              cancelled.resolve();
            },
          }),
        );
      });

      try {
        const req = http.request({ port: server.port, host: "127.0.0.1" });
        req.end();

        const res = await new Promise<http.IncomingMessage>((resolve) =>
          req.on("response", resolve),
        );
        await new Promise<void>((resolve) => res.once("data", () => resolve()));

        assert.equal(signal.aborted, false, "not aborted while connected");

        req.destroy();
        await cancelled.promise;

        assert.equal(signal.aborted, true);
        assert.notEqual(cancelReason, "not cancelled");
      } finally {
        await server.close();
      }
    });

    it("should cancel the body of a response resolved after the client disconnected", async () => {
      const cancelled = deferred();
      const reachedHandler = deferred();
      let cancelWasCalled = false;

      // A handler still mid-`fetch` when the client leaves: it resolves only
      // after its signal aborts, so the middleware's early return is the one
      // and only place its stream can be released.
      const server = await serve(async (request) => {
        reachedHandler.resolve();
        await new Promise<void>((resolve) =>
          request.signal.addEventListener("abort", () => resolve(), {
            once: true,
          }),
        );
        return new Response(
          new ReadableStream({
            cancel() {
              cancelWasCalled = true;
              cancelled.resolve();
            },
          }),
        );
      });

      try {
        const req = http.request({ port: server.port, host: "127.0.0.1" });
        // Destroying before any response arrives makes the client request
        // itself error with a socket hang up; that is the point of the test.
        req.on("error", () => {});
        req.end();

        await reachedHandler.promise;
        req.destroy();
        await cancelled.promise;

        assert.equal(cancelWasCalled, true);
      } finally {
        await server.close();
      }
    });

    it("should not abort the signal when the response completes normally", async () => {
      let signal!: AbortSignal;

      const server = await serve(async (request) => {
        signal = request.signal;
        return new Response("done");
      });

      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`);
        assert.equal(await response.text(), "done");

        // `close` lands after the body is delivered, so give it a turn: an abort
        // here would fire cleanup on every successful request.
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(signal.aborted, false);
      } finally {
        await server.close();
      }
    });
  });
});

import assert from "assert";
import http from "http";
import type { AddressInfo } from "net";

import {
  copyResponseHeaders,
  createMiddleware,
  getBodyReader,
} from "../adapter/middleware";
import type { Fetch } from "../runtime";

const kRender = Symbol.for("@marko/run.render");
const encoder = new TextEncoder();

// The render and the body carry different payloads on purpose, so tests can
// tell which source was picked.
function pageResponse(render: string[], body: string[]) {
  const iterable = (async function* () {
    yield* render;
  })();
  const response = new Response(
    new ReadableStream({
      pull(ctrl) {
        for (const chunk of body) {
          ctrl.enqueue(encoder.encode(chunk));
        }
        ctrl.close();
      },
    }),
  );
  (response as any)[kRender] = { render: iterable, body: response.body };
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

async function serveWithNext(fetch: Fetch<any>) {
  const handled = deferred();
  let passedToNext: unknown;
  const middleware = createMiddleware(fetch);
  const server = http.createServer((req, res) => {
    middleware(req, res, (err) => {
      passedToNext = err;
      res.statusCode = 500;
      res.end("next");
      handled.resolve();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    handled: handled.promise,
    get passedToNext() {
      return passedToNext;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function collect(reader: ReturnType<typeof getBodyReader>) {
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const result = await reader!.read();
    if (result.done) break;
    out +=
      typeof result.value === "string"
        ? result.value
        : decoder.decode(result.value, { stream: true });
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

  describe("getBodyReader", () => {
    it("should take the stashed render for an untouched page response", async () => {
      assert.equal(
        await collect(getBodyReader(pageResponse(["a", "b"], ["A", "B"]))),
        "ab",
      );
    });

    it("should read the body of a response without a render", async () => {
      assert.equal(
        await collect(getBodyReader(new Response("plain"))),
        "plain",
      );
    });

    it("should open nothing for a bodyless response", () => {
      assert.equal(getBodyReader(new Response(null, { status: 204 })), null);
    });

    it("should fall back to the body once `clone()` has teed it", async () => {
      // Cloning drains the single-use render into the two teed branches, so the
      // render no longer holds the output and the body does.
      const response = pageResponse(["a", "b"], ["A", "B"]);
      const clone = response.clone();

      assert.equal(await clone.text(), "AB");
      assert.equal(await collect(getBodyReader(response)), "AB");
    });

    it("should not take the render when something else holds the body", () => {
      const response = pageResponse(["a", "b"], ["A", "B"]);
      response.body!.getReader();

      // Refusing to open beats replaying the render for a body someone
      // else owns.
      assert.throws(() => getBodyReader(response), /locked/);
    });
  });

  describe("createMiddleware", () => {
    it("should abort the request signal and cancel an idle stream when the client disconnects", async () => {
      const cancelled = deferred();
      let signal!: AbortSignal;
      let cancelReason = "not cancelled";

      // Flushes one chunk then goes idle: nothing pulls again, so only the
      // abort can end it.
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

      // Resolves only after the disconnect, so the early return is the only
      // place this stream can be released.
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
        // Destroying pre-response errors the client request; expected here.
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
      const closed = deferred();
      let signal!: AbortSignal;

      // The middleware's own `close` listener registers first, so once this
      // one fires the abort decision has already been made.
      const server = await serve(async (request, platform) => {
        signal = request.signal;
        platform.response.on("close", closed.resolve);
        return new Response("done");
      });

      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`);
        assert.equal(await response.text(), "done");

        await closed.promise;
        assert.equal(signal.aborted, false);
      } finally {
        await server.close();
      }
    });

    it("should pass a non-Error throw to next as an Error", async () => {
      // A null-prototype object has no primitive conversion, so building the
      // message out of the thrown value would throw inside the error path.
      const server = await serveWithNext(async () => {
        throw Object.create(null);
      });

      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/`);
        assert.equal(await response.text(), "next");
        await server.handled;

        const error = server.passedToNext;
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Handler threw a non-Error value");
      } finally {
        await server.close();
      }
    });
  });
});
